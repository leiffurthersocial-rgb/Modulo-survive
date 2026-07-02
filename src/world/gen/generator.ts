/**
 * Pure chunk generation: (seed, dimension, cx, cy) → chunk layers.
 * Runs identically in the worker, on the main thread and in tests — no DOM,
 * no wall-clock, no Math.random. See docs/WORLDGEN.md for the full spec.
 */

import { CHUNK, DEEP_Y, LAVA_LEVEL, SURFACE_BASE, UNDERGROUND_Y, CAVERN_Y, WATER_TABLE, WORLD_H } from '../../data/constants';
import { blockId } from '../../data/blocks';
import { biomeByKey } from '../../data/dimensions';
import type { BiomeDef, DimensionDef } from '../../data/types';
import { clamp, smoothstep } from '../../core/math';
import { hash01, hashCombine, hashString, streamOf } from '../../core/rng';
import { Noise1D, Noise2D } from '../../core/noise';
import { CHUNK_AREA, LIQ_LAVA, LIQ_NONE, LIQ_WATER, type ChunkData } from '../chunk';
import { applyStructures, type TileWriter } from './structures';

// Resolve hot block ids once.
const B = {
  air: 0,
  dirt: blockId('dirt'),
  stone: blockId('stone'),
  deepstone: blockId('deepstone'),
  basalt: blockId('basalt'),
  gravel: blockId('gravel'),
  clay: blockId('clay'),
  ice: blockId('ice'),
  snow: blockId('snow'),
  mud: blockId('mud'),
  mycelium: blockId('mycelium'),
  crystalRock: blockId('crystalRock'),
  dirtWall: blockId('dirtWall'),
  stoneWall: blockId('stoneWall'),
  deepWall: blockId('deepWall'),
  basaltWall: blockId('basaltWall'),
  sandWall: blockId('sandWall'),
  iceWall: blockId('iceWall'),
  mudWall: blockId('mudWall'),
  crystalWall: blockId('crystalWall'),
  ashWall: blockId('ashWall'),
  voidWall: blockId('voidWall'),
  rustWall: blockId('rustWall'),
  cloudWall: blockId('cloudWall'),
  grassTuft: blockId('grassTuft'),
  flowerRed: blockId('flowerRed'),
  flowerBlue: blockId('flowerBlue'),
  flowerYellow: blockId('flowerYellow'),
  mushroom: blockId('mushroom'),
  glowshroom: blockId('glowshroom'),
  deadBush: blockId('deadBush'),
  fern: blockId('fern'),
  iceShard: blockId('iceShard'),
  emberBud: blockId('emberBud'),
  voidBloom: blockId('voidBloom'),
  gearSprout: blockId('gearSprout'),
  cactus: blockId('cactus'),
  crystalCluster: blockId('crystalCluster'),
  web: blockId('web'),
};

/** Wall id used behind a given stone/soil block family. */
function wallFor(id: number): number {
  switch (id) {
    case B.dirt: case B.mud: return B.dirtWall;
    case B.deepstone: return B.deepWall;
    case B.basalt: return B.basaltWall;
    case B.ice: case B.snow: return B.iceWall;
    case B.crystalRock: return B.crystalWall;
    default: break;
  }
  const key = keyOfCached(id);
  if (key === 'grass' || key === 'jungleGrass' || key === 'snowGrass' || key === 'mycelium') return B.dirtWall;
  if (key === 'sandstone' || key === 'sand' || key === 'ancientSoil') return B.sandWall;
  if (key === 'permafrost') return B.iceWall;
  if (key === 'scorchstone' || key === 'ash') return B.ashWall;
  if (key === 'voidrock') return B.voidWall;
  if (key === 'rustplate') return B.rustWall;
  if (key === 'cloudstone') return B.cloudWall;
  return B.stoneWall;
}

import { BLOCK_DEFS } from '../../data/blocks';
const keyCache = BLOCK_DEFS.map((d) => d.key);
function keyOfCached(id: number): string {
  return keyCache[id] ?? 'air';
}

// Ore table: noise field + threshold + depth gate per ore.
interface OreSpec { id: number; salt: number; scale: number; threshold: number; minY: number; maxY: number; noise: Noise2D }

function oreSpecs(seed: number, dim: DimensionDef): OreSpec[] {
  const specs: OreSpec[] = [];
  const add = (key: string, scale: number, threshold: number, minY: number, maxY = WORLD_H) => {
    const salt = hashString(`ore:${key}`);
    specs.push({ id: blockId(key), salt, scale, threshold, minY, maxY, noise: new Noise2D(hashCombine(seed, salt)) });
  };
  if (dim.key === 'overworld') {
    add('coalOre', 0.13, 0.66, SURFACE_BASE - 40);
    add('copperOre', 0.13, 0.69, SURFACE_BASE - 20);
    add('ironOre', 0.12, 0.70, 250);
    add('silverOre', 0.12, 0.73, 300);
    add('goldOre', 0.11, 0.75, 340);
    add('crystalOre', 0.11, 0.74, CAVERN_Y);
    add('meteoricOre', 0.10, 0.80, DEEP_Y);
  } else {
    // Every dimension carries the mid-game ores plus its exclusive.
    add('coalOre', 0.13, 0.68, 0);
    add('ironOre', 0.12, 0.71, 0);
    add(dim.exclusiveOre, 0.115, 0.71, 0);
    add('goldOre', 0.11, 0.75, 320);
  }
  return specs;
}

export interface GenContext {
  seed: number;
  dim: DimensionDef;
  nContinental: Noise1D;
  nErosion: Noise1D;
  nRidge: Noise1D;
  nDetail: Noise1D;
  nTemp: Noise1D;
  nHumid: Noise1D;
  nSpag: Noise2D;
  nCheese: Noise2D;
  nUnder: Noise2D;
  nIsland: Noise2D;
  ores: OreSpec[];
  biomes: BiomeDef[];
}

export function makeGenContext(seed: number, dim: DimensionDef): GenContext {
  const n = (tag: string) => hashCombine(seed, hashString(dim.key), hashString(tag));
  return {
    seed,
    dim,
    nContinental: new Noise1D(n('continental')),
    nErosion: new Noise1D(n('erosion')),
    nRidge: new Noise1D(n('ridge')),
    nDetail: new Noise1D(n('detail')),
    nTemp: new Noise1D(n('temp')),
    nHumid: new Noise1D(n('humid')),
    nSpag: new Noise2D(n('spaghetti')),
    nCheese: new Noise2D(n('cheese')),
    nUnder: new Noise2D(n('underbiome')),
    nIsland: new Noise2D(n('island')),
    ores: oreSpecs(seed, dim),
    biomes: dim.biomes.map(biomeByKey),
  };
}

// ---------------------------------------------------------------------------
// Column shape & climate
// ---------------------------------------------------------------------------

export function surfaceHeightAt(ctx: GenContext, x: number): number {
  const { dim } = ctx;
  const continental = ctx.nContinental.fbm(x * 0.0012, 3);
  const erosion = ctx.nErosion.fbm(x * 0.004, 3) * 0.5 + 0.5; // 0 jagged … 1 flat
  const ridge = ctx.nRidge.ridged(x * 0.008, 4);
  const detail = ctx.nDetail.fbm(x * 0.03, 2);
  const amp = dim.amplitude;
  const h =
    dim.surfaceBase -
    continental * 46 * amp -
    ridge * ridge * 62 * (1 - erosion) * amp +
    detail * 6;
  return clamp(Math.round(h), 24, WORLD_H - 60);
}

export function biomeAt(ctx: GenContext, x: number): BiomeDef {
  if (ctx.biomes.length === 1) return ctx.biomes[0];
  const surface = surfaceHeightAt(ctx, x);
  const altitude = (SURFACE_BASE - surface) / 80; // >0 = high ground
  const t = ctx.nTemp.fbm(x * 0.0016, 2) - Math.max(0, altitude) * 0.55;
  const h = ctx.nHumid.fbm(x * 0.0021, 2);
  // Elevation override: true peaks read as mountains when available.
  if (altitude > 0.62) {
    const m = ctx.biomes.find((b) => b.key === 'mountains');
    if (m) return m;
  }
  let best = ctx.biomes[0];
  let bestD = Infinity;
  for (const b of ctx.biomes) {
    const d = (t - b.temp) * (t - b.temp) + (h - b.humid) * (h - b.humid);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/** Topmost solid y for lighting seeds. Pure w.r.t. generation. */
export function estimateSurface(ctx: GenContext, x: number): number {
  if (ctx.dim.terrainMode === 'columns') return surfaceHeightAt(ctx, x);
  for (let y = 40; y < WORLD_H; y++) {
    if (islandSolid(ctx, x, y)) return y;
  }
  return WORLD_H;
}

// ---------------------------------------------------------------------------
// Island field (Sky & Void strata)
// ---------------------------------------------------------------------------

function islandSolid(ctx: GenContext, x: number, y: number): boolean {
  if (y < 60 || y > WORLD_H - 50) return false;
  const band = Math.sin(((y - 60) / (WORLD_H - 110)) * Math.PI); // fade at band edges
  const v = ctx.nIsland.fbm(x * 0.011, y * 0.028, 4);
  return v * band > 0.14;
}

// ---------------------------------------------------------------------------
// Chunk generation
// ---------------------------------------------------------------------------

export function generateChunkData(seed: number, dim: DimensionDef, cx: number, cy: number): ChunkData {
  const ctx = makeGenContext(seed, dim);
  const fg = new Uint16Array(CHUNK_AREA);
  const bg = new Uint16Array(CHUNK_AREA);
  const liquid = new Uint8Array(CHUNK_AREA);
  const liquidType = new Uint8Array(CHUNK_AREA);
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;

  // Per-column precomputation (with margins used by decoration).
  const surface: number[] = [];
  const biome: BiomeDef[] = [];
  for (let lx = 0; lx < CHUNK; lx++) {
    surface[lx] = surfaceHeightAt(ctx, x0 + lx);
    biome[lx] = biomeAt(ctx, x0 + lx);
  }

  const stoneId = blockId(dim.stone);
  const topsoilDepthSalt = hashString('soilDepth');

  for (let ly = 0; ly < CHUNK; ly++) {
    const y = y0 + ly;
    for (let lx = 0; lx < CHUNK; lx++) {
      const x = x0 + lx;
      const i = ly * CHUNK + lx;
      const b = biome[lx];
      const surf = surface[lx];

      let id = B.air;
      let wall = B.air;

      if (dim.terrainMode === 'islands') {
        if (islandSolid(ctx, x, y)) {
          const above = islandSolid(ctx, x, y - 1);
          const above4 = above && islandSolid(ctx, x, y - 4);
          id = !above ? blockId(b.topsoil) : !above4 ? blockId(b.subsoil) : stoneId;
          wall = wallFor(id);
        }
      } else {
        if (y >= surf) {
          const soilDepth = 4 + Math.floor(hash01(ctx.seed, x, 0, topsoilDepthSalt) * 4);
          if (y === surf) id = blockId(b.topsoil);
          else if (y < surf + soilDepth) id = blockId(b.subsoil);
          else if (y >= WORLD_H - 3) id = dim.key === 'void' ? blockId('voidrock') : B.basalt;
          else if (dim.key === 'overworld') id = y >= DEEP_Y ? B.basalt : y >= 340 ? B.deepstone : B.stone;
          else id = y >= DEEP_Y ? B.basalt : stoneId;

          // Underground biome patches (overworld only).
          if (dim.key === 'overworld' && (id === B.deepstone || id === B.stone)) {
            if (y > CAVERN_Y && y < DEEP_Y && ctx.nUnder.fbm(x * 0.006, y * 0.006, 2) > 0.44) {
              id = B.crystalRock;
            } else if (y > UNDERGROUND_Y && y < CAVERN_Y && ctx.nUnder.fbm(x * 0.007 + 500, y * 0.007, 2) > 0.5) {
              id = B.mud;
            }
          }

          // Ores replace stone-family tiles.
          if (id !== B.air && y > surf + 3) {
            for (const ore of ctx.ores) {
              const gate = ore.minY < SURFACE_BASE ? Math.max(ore.minY, surf + 6) : ore.minY;
              if (y < gate || y > ore.maxY) continue;
              if (ore.noise.fbm(x * ore.scale, y * ore.scale, 2) > ore.threshold) {
                id = ore.id;
                break;
              }
            }
          }

          // Walls exist a couple of tiles beneath the surface.
          if (y > surf + 1 && y < WORLD_H - 3) wall = wallFor(id === B.air ? stoneId : id);

          // Caves carve after fill (never the bedrock band).
          if (y > surf + 2 && y < WORLD_H - 4) {
            const depthFactor = smoothstep(surf + 10, DEEP_Y, y);
            const spag = Math.abs(ctx.nSpag.fbm(x * 0.02, y * 0.032, 3));
            const entrance = smoothstep(surf + 26, surf + 4, y) * 0.018;
            if (spag < (0.04 + depthFactor * 0.025) * dim.caveDensity + entrance) id = B.air;
            else if (y > surf + 30) {
              const cheese = ctx.nCheese.fbm(x * 0.016, y * 0.021, 3);
              if (cheese > (0.3 - depthFactor * 0.08) / dim.caveDensity) {
                id = B.air;
                // Underground lakes.
                if (dim.liquid !== 'none' && y > WATER_TABLE && cheese > 0.4) {
                  liquid[i] = 8;
                  liquidType[i] = dim.liquid === 'lava' ? LIQ_LAVA : LIQ_WATER;
                }
              }
            }
            // The deep stratum floods with lava regardless of carve type.
            if (id === B.air && y > LAVA_LEVEL && dim.liquid !== 'none') {
              liquid[i] = 8;
              liquidType[i] = LIQ_LAVA;
            }
          }
        } else {
          // Above the surface: valley lakes.
          const lakeLevel = dim.surfaceBase + 18;
          if (dim.liquid !== 'none' && y > lakeLevel && y < surf) {
            liquid[i] = 8;
            liquidType[i] = dim.liquid === 'lava' ? LIQ_LAVA : LIQ_WATER;
          }
        }
      }

      fg[i] = id;
      bg[i] = wall;
    }
  }

  // Structures may add or carve tiles; they write with the same writer trees use.
  const write: TileWriter = (x, y, layer, id) => {
    const lx = x - x0;
    const ly = y - y0;
    if (lx < 0 || lx >= CHUNK || ly < 0 || ly >= CHUNK) return;
    const i = ly * CHUNK + lx;
    if (layer === 'fg') fg[i] = id;
    else bg[i] = id;
    if (id !== B.air && layer === 'fg') {
      liquid[i] = 0;
      liquidType[i] = LIQ_NONE;
    }
  };
  const surfacePure = (x: number) => surfaceHeightAt(ctx, x);
  applyStructures(seed, dim, cx, cy, write, surfacePure);

  // Trees & decoration (columns mode; islands get sparse decoration below).
  if (dim.terrainMode === 'columns') {
    decorateColumns(ctx, cx, cy, fg, write);
  } else {
    decorateIslands(ctx, cx, cy, fg, write);
  }

  return { fg, bg, liquid, liquidType };
}

// ---------------------------------------------------------------------------
// Decoration
// ---------------------------------------------------------------------------

const SPECIES_LOG = new Map<string, number>();
const SPECIES_LEAF = new Map<string, number>();
for (const s of ['oak', 'pine', 'palm', 'jungle', 'dusk', 'frost']) {
  SPECIES_LOG.set(s, blockId(`${s}Log`));
  SPECIES_LEAF.set(s, blockId(`${s}Leaves`));
}

function decorateColumns(ctx: GenContext, cx: number, cy: number, fg: Uint16Array, write: TileWriter): void {
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const treeSalt = hashString('tree');
  const plantSalt = hashString('plant');
  const caveDecoSalt = hashString('caveDeco');

  // Trees: evaluated for a margin of columns so canopies cross chunk borders
  // consistently (pure per-column decisions).
  for (let x = x0 - 4; x < x0 + CHUNK + 4; x++) {
    const b = biomeAt(ctx, x);
    if (!b.treeSpecies || b.treeDensity <= 0) continue;
    if (hash01(ctx.seed, x, 0, treeSalt) > b.treeDensity) continue;
    // No trees on cliffs: neighbors must be within 2 tiles of height.
    const surf = surfaceHeightAt(ctx, x);
    if (Math.abs(surfaceHeightAt(ctx, x - 1) - surf) > 2 || Math.abs(surfaceHeightAt(ctx, x + 1) - surf) > 2) continue;
    // Suppress adjacent trees deterministically: the lowest roll in a 3-column window wins.
    const my = hash01(ctx.seed, x, 0, treeSalt);
    const left = hash01(ctx.seed, x - 1, 0, treeSalt);
    const right = hash01(ctx.seed, x + 1, 0, treeSalt);
    const bL = biomeAt(ctx, x - 1);
    const bR = biomeAt(ctx, x + 1);
    if ((left <= bL.treeDensity && left < my) || (right <= bR.treeDensity && right < my)) continue;
    const rng = streamOf(ctx.seed, 'treeShape', x);
    const height = rng.int(4, 8);
    const logId = SPECIES_LOG.get(b.treeSpecies)!;
    const leafId = SPECIES_LEAF.get(b.treeSpecies)!;
    for (let ty = surf - height; ty < surf; ty++) write(x, ty, 'fg', logId);
    const canopyR = rng.int(2, 3);
    const topY = surf - height;
    for (let dy = -canopyR - 1; dy <= canopyR - 1; dy++) {
      for (let dx = -canopyR; dx <= canopyR; dx++) {
        if (dx * dx + dy * dy > canopyR * canopyR + 1) continue;
        if (dx === 0 && dy >= 0) continue; // keep trunk visible
        const wx = x + dx;
        const wy = topY + dy;
        if (wy >= surf) continue;
        if (hash01(ctx.seed, wx, wy, treeSalt) < 0.12) continue; // ragged edges
        // Leaves never overwrite logs.
        const lx = wx - x0;
        const ly = wy - y0;
        if (lx >= 0 && lx < CHUNK && ly >= 0 && ly < CHUNK && fg[ly * CHUNK + lx] === logId) continue;
        write(wx, wy, 'fg', leafId);
      }
    }
  }

  // Small surface plants + cave decoration (chunk-local only).
  for (let lx = 0; lx < CHUNK; lx++) {
    const x = x0 + lx;
    const b = biomeAt(ctx, x);
    const surf = surfaceHeightAt(ctx, x);
    const py = surf - 1;
    if (py >= y0 && py < y0 + CHUNK) {
      const ly = py - y0;
      const i = ly * CHUNK + lx;
      const below = ly + 1 < CHUNK ? fg[(ly + 1) * CHUNK + lx] : -1;
      if (fg[i] === B.air && below === blockId(b.topsoil)) {
        const roll = hash01(ctx.seed, x, py, plantSalt);
        let deco = 0;
        if (b.key === 'desert') deco = roll < 0.05 ? B.cactus : roll < 0.09 ? B.deadBush : 0;
        else if (b.key === 'snowfields') deco = roll < 0.05 ? B.iceShard : 0;
        else if (b.key === 'volcanic') deco = roll < 0.06 ? B.emberBud : 0;
        else if (b.key === 'jungle') deco = roll < 0.2 ? B.fern : roll < 0.26 ? B.flowerRed : 0;
        else deco = roll < 0.22 ? B.grassTuft : roll < 0.25 ? B.flowerYellow : roll < 0.28 ? B.flowerBlue : roll < 0.3 ? B.flowerRed : 0;
        if (deco) write(x, py, 'fg', deco);
        // Desert cacti grow tall.
        if (deco === B.cactus) {
          const h = 1 + Math.floor(roll * 60) % 3;
          for (let k = 1; k <= h; k++) write(x, py - k, 'fg', B.cactus);
        }
      }
    }
    // Cave floor decoration within this chunk.
    for (let ly = 1; ly < CHUNK; ly++) {
      const y = y0 + ly;
      if (y <= surf + 8) continue;
      const i = ly * CHUNK + lx;
      const belowI = ly + 1 < CHUNK ? (ly + 1) * CHUNK + lx : -1;
      if (belowI < 0 || fg[i] !== B.air) continue;
      const below = fg[belowI];
      if (below === B.air) continue;
      const roll = hash01(ctx.seed, x, y, caveDecoSalt);
      if (below === B.crystalRock && roll < 0.06) write(x, y, 'fg', B.crystalCluster);
      else if (below === B.mud && roll < 0.08) write(x, y, 'fg', roll < 0.04 ? B.glowshroom : B.mushroom);
      else if (roll < 0.012) write(x, y, 'fg', roll < 0.005 ? B.glowshroom : B.mushroom);
      else if (y > CAVERN_Y && roll > 0.994) write(x, y, 'fg', B.web);
    }
  }
}

function decorateIslands(ctx: GenContext, cx: number, cy: number, fg: Uint16Array, write: TileWriter): void {
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const decoSalt = hashString('islandDeco');
  const b = ctx.biomes[0];
  for (let lx = 0; lx < CHUNK; lx++) {
    for (let ly = 1; ly < CHUNK; ly++) {
      const i = ly * CHUNK + lx;
      const belowI = ly + 1 < CHUNK ? (ly + 1) * CHUNK + lx : -1;
      if (belowI < 0 || fg[i] !== B.air) continue;
      if (fg[belowI] !== blockId(b.topsoil)) continue;
      const x = x0 + lx;
      const y = y0 + ly;
      const roll = hash01(ctx.seed, x, y, decoSalt);
      if (ctx.dim.key === 'void') {
        if (roll < 0.06) write(x, y, 'fg', B.voidBloom);
      } else if (roll < 0.12) {
        write(x, y, 'fg', roll < 0.03 ? B.flowerYellow : B.grassTuft);
      }
      // Small trees on wide island tops.
      if (b.treeSpecies && roll > 0.97 && islandSolid(ctx, x - 2, y + 1) && islandSolid(ctx, x + 2, y + 1)) {
        const rng = streamOf(ctx.seed, 'islandTree', x, y);
        const h = rng.int(3, 5);
        const logId = SPECIES_LOG.get(b.treeSpecies)!;
        const leafId = SPECIES_LEAF.get(b.treeSpecies)!;
        for (let k = 1; k <= h; k++) write(x, y - k + 1, 'fg', logId);
        for (let dx = -2; dx <= 2; dx++) {
          for (let dy = -2; dy <= 0; dy++) {
            if (Math.abs(dx) === 2 && dy !== -1) continue;
            write(x + dx, y - h + dy, 'fg', leafId);
          }
        }
      }
    }
  }
}
