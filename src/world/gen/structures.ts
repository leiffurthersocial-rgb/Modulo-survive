/**
 * Landmark structures. Placement is region-seeded and rasterization is pure:
 * every chunk overlapping a structure draws its own slice from the same seed,
 * so multi-chunk buildings need no cross-chunk communication (WORLDGEN.md §5).
 */

import { CHUNK, CAVERN_Y, DEEP_Y, UNDERGROUND_Y } from '../../data/constants';
import { blockId } from '../../data/blocks';
import type { DimensionDef } from '../../data/types';
import { floorDiv } from '../../core/math';
import { hash01, hashString, streamOf, type RNG } from '../../core/rng';

export type TileWriter = (x: number, y: number, layer: 'fg' | 'bg', id: number) => void;

const B = () => ({
  air: 0,
  ancientBrick: blockId('ancientBrick'),
  ancientWall: blockId('ancientBrickWall'),
  labPlate: blockId('labPlate'),
  labWall: blockId('labPlateWall'),
  obsidianBrick: blockId('obsidianBrick'),
  cityBrick: blockId('cityBrick'),
  cityWall: blockId('cityBrickWall'),
  glass: blockId('glass'),
  plank: blockId('plank'),
  plankWall: blockId('plankWall'),
  chest: blockId('chest'),
  goldChest: blockId('goldChest'),
  lootUrn: blockId('lootUrn'),
  spikes: blockId('spikes'),
  campfire: blockId('campfire'),
  loreTablet: blockId('loreTablet'),
  arcLamp: blockId('arcLamp'),
  torch: blockId('torch'),
  dirt: blockId('dirt'),
  grass: blockId('grass'),
  stone: blockId('stone'),
  oakLog: blockId('oakLog'),
  oakLeaves: blockId('oakLeaves'),
  gearSprout: blockId('gearSprout'),
});
let ids: ReturnType<typeof B> | null = null;

interface StructureKind {
  key: string;
  /** Region edge in chunks (surface kinds use X-regions, buried use X×Y). */
  region: number;
  chance: number;
  place: 'surface' | 'underground' | 'cavern' | 'sky';
  dims: string[];
  raster: (rng: RNG, seed: number, ax: number, ay: number, write: TileWriter) => void;
}

const KINDS: StructureKind[] = [
  { key: 'obelisk', region: 4, chance: 0.18, place: 'surface', dims: ['overworld', 'ancient'], raster: rasterObelisk },
  { key: 'camp', region: 4, chance: 0.14, place: 'surface', dims: ['overworld', 'frozen', 'crystal'], raster: rasterCamp },
  { key: 'ruin', region: 8, chance: 0.3, place: 'surface', dims: ['overworld', 'ancient'], raster: rasterRuin },
  { key: 'lab', region: 8, chance: 0.18, place: 'underground', dims: ['overworld', 'machine'], raster: rasterLab },
  { key: 'vault', region: 8, chance: 0.22, place: 'cavern', dims: ['overworld', 'ancient', 'crystal', 'molten', 'frozen', 'machine'], raster: rasterVault },
  { key: 'city', region: 16, chance: 0.12, place: 'cavern', dims: ['overworld'], raster: rasterCity },
  { key: 'floatIsland', region: 8, chance: 0.25, place: 'sky', dims: ['overworld'], raster: rasterFloatIsland },
];

export function applyStructures(
  seed: number,
  dim: DimensionDef,
  cx: number,
  cy: number,
  write: TileWriter,
  surfaceAt: (x: number) => number,
): void {
  if (dim.terrainMode === 'islands') return; // island strata carry no buried structures (v1)
  ids ??= B();
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;

  for (const kind of KINDS) {
    if (!kind.dims.includes(dim.key)) continue;
    const regionTiles = kind.region * CHUNK;
    // Candidate regions overlapping this chunk (structures are < 1 region wide).
    const r0 = floorDiv(x0 - regionTiles, regionTiles);
    const r1 = floorDiv(x0 + CHUNK + regionTiles, regionTiles);
    for (let rx = r0; rx <= r1; rx++) {
      const rng = streamOf(seed, 'struct', kind.key, rx, dim.key);
      if (!rng.chance(kind.chance)) continue;
      const ax = rx * regionTiles + rng.int(8, regionTiles - 8);
      let ay: number;
      switch (kind.place) {
        case 'surface': ay = surfaceAt(ax); break;
        case 'underground': ay = rng.int(UNDERGROUND_Y + 10, CAVERN_Y - 10); break;
        case 'cavern': ay = rng.int(CAVERN_Y + 10, DEEP_Y - 20); break;
        case 'sky': ay = rng.int(70, 130); break;
      }
      // Quick reject: structures are at most 100×40 tiles.
      if (ax + 60 < x0 - 40 || ax - 60 > x0 + CHUNK + 40) continue;
      if (ay + 50 < y0 - 10 || ay - 50 > y0 + CHUNK + 10) continue;
      kind.raster(rng, seed, ax, ay, write);
    }
  }
}

// ---------------------------------------------------------------------------
// Rasterizers (pure functions of their RNG + per-tile hashes)
// ---------------------------------------------------------------------------

function rasterObelisk(rng: RNG, seed: number, ax: number, ay: number, write: TileWriter): void {
  const b = ids!;
  const h = rng.int(5, 9);
  for (let y = ay - h; y < ay; y++) {
    write(ax, y, 'fg', b.ancientBrick);
    write(ax + 1, y, 'fg', b.ancientBrick);
  }
  write(ax - 1, ay - 1, 'fg', b.loreTablet);
}

function rasterCamp(rng: RNG, seed: number, ax: number, ay: number, write: TileWriter): void {
  const b = ids!;
  write(ax, ay - 1, 'fg', b.campfire);
  write(ax + 2, ay - 1, 'fg', b.chest);
  // Collapsed tent: a plank lean-to.
  const th = rng.int(3, 4);
  for (let k = 0; k < th; k++) {
    for (let y = ay - 1 - k; y >= ay - th; y--) write(ax - 3 - k, y, 'bg', b.plankWall);
    write(ax - 3 - k, ay - th + (th - 1 - k), 'fg', b.plank);
  }
  if (rng.chance(0.6)) write(ax - 1, ay - 1, 'fg', b.torch);
}

function rasterRuin(rng: RNG, seed: number, ax: number, ay: number, write: TileWriter): void {
  const b = ids!;
  const w = rng.int(24, 38);
  const h = rng.int(12, 18);
  const top = ay - Math.floor(h * 0.4); // partially buried
  const decaySalt = hashString('ruinDecay');
  const chestRoomX = rng.int(1, Math.floor(w / 8) - 1);
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      const x = ax + dx;
      const y = top + dy;
      const isWall = dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1 || dx % 8 === 0 || dy % 6 === 0;
      const decay = hash01(seed, x, y, decaySalt) < 0.22;
      if (isWall) {
        if (!decay) write(x, y, 'fg', b.ancientBrick);
        write(x, y, 'bg', b.ancientWall);
      } else {
        write(x, y, 'fg', b.air);
        write(x, y, 'bg', b.ancientWall);
        const onFloor = (dy + 1) % 6 === 0;
        if (onFloor) {
          const roll = hash01(seed, x, y, decaySalt + 1);
          if (Math.floor(dx / 8) === chestRoomX && roll < 0.06) write(x, y, 'fg', b.chest);
          else if (roll < 0.12) write(x, y, 'fg', b.lootUrn);
          else if (roll > 0.96) write(x, y, 'fg', b.spikes);
        }
      }
    }
  }
}

function rasterLab(rng: RNG, seed: number, ax: number, ay: number, write: TileWriter): void {
  const b = ids!;
  const w = rng.int(20, 28);
  const h = rng.int(10, 14);
  const decoSalt = hashString('labDeco');
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      const x = ax + dx;
      const y = ay + dy;
      const border = dx < 2 || dx >= w - 2 || dy < 2 || dy >= h - 2;
      if (border) {
        write(x, y, 'fg', b.labPlate);
      } else {
        write(x, y, 'fg', b.air);
        write(x, y, 'bg', b.labWall);
        if (dy === 2 && dx % 6 === 3) write(x, y, 'fg', b.arcLamp);
        if (dy === h - 3) {
          const roll = hash01(seed, x, y, decoSalt);
          if (roll < 0.08) write(x, y, 'fg', b.chest);
          else if (roll < 0.2) write(x, y, 'fg', b.gearSprout);
        }
      }
    }
  }
}

function rasterVault(rng: RNG, seed: number, ax: number, ay: number, write: TileWriter): void {
  const b = ids!;
  const r = rng.int(6, 9);
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      const x = ax + dx;
      const y = ay + dy;
      if (d > r) continue;
      if (d > r - 1.6) write(x, y, 'fg', b.obsidianBrick);
      else {
        write(x, y, 'fg', b.air);
        write(x, y, 'bg', b.cityWall);
      }
    }
  }
  write(ax, ay + r - 2, 'fg', b.goldChest);
  write(ax - 2, ay + r - 2, 'fg', b.lootUrn);
  write(ax + 2, ay + r - 2, 'fg', b.lootUrn);
}

function rasterCity(rng: RNG, seed: number, ax: number, ay: number, write: TileWriter): void {
  const b = ids!;
  const w = rng.int(64, 90);
  const h = 30;
  const floorY = ay + h - 2;
  const decaySalt = hashString('cityDecay');
  // Cavity with a floor.
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      const x = ax + dx;
      const y = ay + dy;
      if (dy >= h - 2 || dy < 2) {
        write(x, y, 'fg', b.cityBrick);
      } else {
        write(x, y, 'fg', b.air);
        write(x, y, 'bg', b.cityWall);
      }
    }
  }
  // Buildings every 14 tiles.
  const buildings = Math.floor((w - 8) / 14);
  const goldIn = rng.int(0, Math.max(0, buildings - 1));
  for (let bi = 0; bi < buildings; bi++) {
    const bx = ax + 4 + bi * 14;
    const bw = 9;
    const bh = rng.int(9, 13);
    for (let dx = 0; dx < bw; dx++) {
      for (let dy = 0; dy < bh; dy++) {
        const x = bx + dx;
        const y = floorY - 1 - dy;
        const isWall = dx === 0 || dx === bw - 1 || dy === 0 || dy === bh - 1;
        const isWindow = !isWall && dy >= 3 && dy <= 5 && (dx === 2 || dx === 3 || dx === bw - 3 || dx === bw - 4);
        const isDoorway = dx === 0 && dy >= 1 && dy <= 3;
        if (isDoorway) write(x, y, 'fg', b.air);
        else if (isWindow) write(x, y, 'fg', b.glass);
        else if (isWall && hash01(seed, x, y, decaySalt) > 0.12) write(x, y, 'fg', b.cityBrick);
        else write(x, y, 'fg', b.air);
      }
    }
    // Interior loot.
    const chestId = bi === goldIn ? b.goldChest : b.chest;
    if (hash01(seed, bx, floorY, decaySalt) < 0.75) write(bx + 3, floorY - 2, 'fg', chestId);
    write(bx - 3, floorY - 2, 'fg', b.arcLamp);
  }
}

function rasterFloatIsland(rng: RNG, seed: number, ax: number, ay: number, write: TileWriter): void {
  const b = ids!;
  const rx = rng.int(8, 13);
  const ry = rng.int(4, 6);
  const noiseSalt = hashString('islandEdge');
  for (let dx = -rx; dx <= rx; dx++) {
    for (let dy = -ry; dy <= ry; dy++) {
      const v = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (v > 1 - hash01(seed, ax + dx, ay + dy, noiseSalt) * 0.25) continue;
      const x = ax + dx;
      const y = ay + dy;
      const topOfColumn = (dx * dx) / (rx * rx) + ((dy - 1) * (dy - 1)) / (ry * ry) > 1;
      write(x, y, 'fg', dy > 1 ? b.stone : topOfColumn && dy <= 0 ? b.grass : b.dirt);
    }
  }
  write(ax, ay - ry - 1, 'fg', b.goldChest);
  // A small oak on top.
  const tx = ax - Math.floor(rx / 2);
  for (let k = 1; k <= 4; k++) write(tx, ay - ry - k, 'fg', b.oakLog);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -6; dy <= -4; dy++) {
      if (Math.abs(dx) === 2 && dy !== -5) continue;
      write(tx + dx, ay - ry + dy, 'fg', b.oakLeaves);
    }
  }
}
