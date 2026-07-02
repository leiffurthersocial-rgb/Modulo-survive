/**
 * Block registry. Ids are registration order (0 = air) and fit in Uint16 chunk
 * layers. Saves persist an id→key manifest so reordering never corrupts worlds.
 * All visuals are painted procedurally from `color`/`color2`/`style`
 * (render/textures.ts) — no image assets exist.
 */

import type { BlockDef, StationKind } from './types';

const defs: BlockDef[] = [];
const byKey = new Map<string, number>();

function reg(def: BlockDef): number {
  if (byKey.has(def.key)) throw new Error(`duplicate block key: ${def.key}`);
  const id = defs.length;
  defs.push(def);
  byKey.set(def.key, id);
  return id;
}

const solidDefaults = { solid: true, tool: 'pick' as const };

// ---------------------------------------------------------------------------
// 0 — Air
// ---------------------------------------------------------------------------
export const AIR = reg({
  key: 'air',
  name: 'Air',
  color: 0x000000,
  style: 'wallPlain',
  solid: false,
  hardness: 0,
  drops: null,
  noItem: true,
  opacity: 0,
});

// ---------------------------------------------------------------------------
// Natural terrain
// ---------------------------------------------------------------------------
reg({ key: 'dirt', name: 'Dirt', color: 0x6b4a2f, style: 'soil', hardness: 0.5, ...solidDefaults });
reg({ key: 'grass', name: 'Meadow Grass', color: 0x6b4a2f, color2: 0x58b04c, style: 'grassTop', hardness: 0.55, drops: 'dirt', ...solidDefaults });
reg({ key: 'jungleGrass', name: 'Jungle Sod', color: 0x5a4426, color2: 0x2f9e44, style: 'grassTop', hardness: 0.55, drops: 'dirt', ...solidDefaults });
reg({ key: 'snowGrass', name: 'Frosted Turf', color: 0x6b4a2f, color2: 0xe8f0f5, style: 'grassTop', hardness: 0.55, drops: 'dirt', ...solidDefaults });
reg({ key: 'sand', name: 'Sand', color: 0xd9c27e, style: 'sand', hardness: 0.4, ...solidDefaults });
reg({ key: 'sandstone', name: 'Sandstone', color: 0xc2a25c, style: 'stone', hardness: 0.9, ...solidDefaults });
reg({ key: 'snow', name: 'Snow', color: 0xe8f0f5, style: 'snow', hardness: 0.35, ...solidDefaults });
reg({ key: 'ice', name: 'Ice', color: 0x9fd4e8, style: 'ice', hardness: 0.6, ...solidDefaults });
reg({ key: 'stone', name: 'Stone', color: 0x8a8f98, style: 'stone', hardness: 1.0, ...solidDefaults });
reg({ key: 'deepstone', name: 'Deepstone', color: 0x5a5e6b, style: 'stone', hardness: 1.6, minPower: 2, ...solidDefaults });
reg({ key: 'basalt', name: 'Basalt', color: 0x3a3540, style: 'stone', hardness: 2.0, minPower: 3, ...solidDefaults });
reg({ key: 'gravel', name: 'Gravel', color: 0x7f7a72, style: 'sand', hardness: 0.5, ...solidDefaults });
reg({ key: 'clay', name: 'Clay', color: 0xa9705a, style: 'soil', hardness: 0.6, ...solidDefaults });
reg({ key: 'mud', name: 'Mud', color: 0x4e3b2a, style: 'soil', hardness: 0.5, ...solidDefaults });
reg({ key: 'mycelium', name: 'Mycelium', color: 0x5a4a63, color2: 0xb08ad0, style: 'grassTop', hardness: 0.55, drops: 'dirt', ...solidDefaults });
reg({ key: 'ash', name: 'Ash', color: 0x6d6a70, style: 'sand', hardness: 0.45, ...solidDefaults });
reg({ key: 'obsidian', name: 'Obsidian', color: 0x2a1e3f, style: 'stone', hardness: 3.2, minPower: 4, ...solidDefaults });
reg({ key: 'tilledSoil', name: 'Tilled Soil', color: 0x54381f, style: 'soil', hardness: 0.5, drops: 'dirt', noItem: true, ...solidDefaults });
reg({ key: 'cloudstone', name: 'Cloudstone', color: 0xdfe8f5, style: 'cloud', hardness: 0.5, ...solidDefaults });
reg({ key: 'voidrock', name: 'Voidrock', color: 0x241f33, color2: 0x5d4a8a, style: 'stone', hardness: 2.4, minPower: 4, ...solidDefaults });
reg({ key: 'ancientSoil', name: 'Ancient Dust', color: 0x8a6a45, style: 'sand', hardness: 0.5, ...solidDefaults });
reg({ key: 'crystalRock', name: 'Prismatic Rock', color: 0x7a6f9e, color2: 0xc9b8f0, style: 'stone', hardness: 1.8, minPower: 2, ...solidDefaults });
reg({ key: 'permafrost', name: 'Permafrost', color: 0x8fa8bd, style: 'stone', hardness: 1.4, minPower: 2, ...solidDefaults });
reg({ key: 'scorchstone', name: 'Scorchstone', color: 0x59372e, style: 'stone', hardness: 1.8, minPower: 3, ...solidDefaults });
reg({ key: 'rustplate', name: 'Rusted Plating', color: 0x6e4a33, color2: 0x9c6b45, style: 'plate', hardness: 1.9, minPower: 3, ...solidDefaults });

// ---------------------------------------------------------------------------
// Ores (vein color over host stone)
// ---------------------------------------------------------------------------
const ore = (key: string, name: string, color2: number, hardness: number, minPower: number, host = 0x8a8f98, light = 0) =>
  reg({ key, name, color: host, color2, style: 'ore', hardness, minPower, light, ...solidDefaults });

ore('coalOre', 'Coal Seam', 0x23252b, 1.1, 0);
ore('copperOre', 'Copper Ore', 0xc97b4a, 1.2, 0);
ore('ironOre', 'Iron Ore', 0xc9b7a5, 1.4, 1);
ore('silverOre', 'Silver Ore', 0xd8dee8, 1.6, 2);
ore('goldOre', 'Gold Ore', 0xe8c84a, 1.8, 2);
ore('crystalOre', 'Crystal Shards', 0x8be0e8, 2.0, 2, 0x5a5e6b, 6);
ore('meteoricOre', 'Meteoric Core', 0xff8a50, 2.4, 3, 0x3a3540, 4);
ore('relictiumOre', 'Relictium Ore', 0xd8b25e, 2.6, 3, 0x8a6a45);
ore('prismiteOre', 'Prismite Ore', 0xe0b8ff, 2.6, 3, 0x7a6f9e, 7);
ore('cryostalOre', 'Cryostal Ore', 0x9ff0ff, 2.6, 3, 0x8fa8bd, 5);
ore('magmiteOre', 'Magmite Ore', 0xff6a33, 2.8, 4, 0x59372e, 6);
ore('ferroxOre', 'Ferrox Nodes', 0xb8c4cc, 2.8, 4, 0x6e4a33);
ore('auraliteOre', 'Auralite Ore', 0xfff0a0, 2.6, 3, 0xdfe8f5, 6);
ore('voidglassOre', 'Voidglass Ore', 0x9a7ae8, 3.2, 5, 0x241f33, 5);

// ---------------------------------------------------------------------------
// Trees (log + leaves per species)
// ---------------------------------------------------------------------------
// Trees are scenery, not walls: logs/leaves never block movement. Chopping a
// trunk fells everything above it (game/player.ts breakTile cascade).
const wood = (key: string, name: string, logC: number, leafC: number) => {
  reg({ key: `${key}Log`, name: `${name} Log`, color: logC, style: 'log', solid: false, tool: 'axe', hardness: 0.9, opacity: 2 });
  reg({ key: `${key}Leaves`, name: `${name} Leaves`, color: leafC, style: 'leaf', solid: false, tool: 'any', hardness: 0.15, drops: null, opacity: 2, noItem: true });
};
wood('oak', 'Oak', 0x7a5230, 0x4e9c46);
wood('pine', 'Pine', 0x5d4027, 0x2f6b4f);
wood('palm', 'Palm', 0x9c7a4a, 0x6fb04c);
wood('jungle', 'Jungle', 0x6b4d2e, 0x2f9e44);
wood('dusk', 'Duskwood', 0x4a3a52, 0x8a5fb0);
wood('frost', 'Frostbough', 0x87a6b8, 0xcfe6f0);

// ---------------------------------------------------------------------------
// Flora & small naturals (non-solid, fragile)
// ---------------------------------------------------------------------------
const plant = (key: string, name: string, color: number, opts: Partial<BlockDef> = {}) =>
  reg({ key, name, color, style: 'plant', solid: false, hardness: 0.05, tool: 'any', fragile: true, needsFloor: true, opacity: 0, ...opts });

plant('grassTuft', 'Grass Tuft', 0x58b04c, { drops: 'plantFiber', noItem: true });
plant('flowerRed', 'Emberbell', 0xd94f4f);
plant('flowerBlue', 'Driftbloom', 0x5f8fd9);
plant('flowerYellow', 'Suncup', 0xe8c84a);
plant('mushroom', 'Brown Cap', 0xa9705a);
plant('glowshroom', 'Glowshroom', 0x9fe8d0, { light: 8 });
plant('deadBush', 'Dead Bush', 0x8a6a45);
plant('fern', 'Fern', 0x2f9e44);
plant('iceShard', 'Ice Spur', 0xbfe8f5, { light: 3 });
plant('emberBud', 'Ember Bud', 0xff8a50, { light: 6 });
plant('voidBloom', 'Void Bloom', 0x9a7ae8, { light: 5 });
plant('gearSprout', 'Gear Sprout', 0xb8c4cc);
reg({ key: 'cactus', name: 'Cactus', color: 0x3f8f4f, style: 'plant', solid: true, tool: 'axe', hardness: 0.4, hazard: { dmg: 4 }, needsFloor: true });
reg({ key: 'vine', name: 'Vine', color: 0x2f7e3d, style: 'rope', solid: false, hardness: 0.05, tool: 'any', climbable: true, fragile: true, opacity: 0 });
reg({ key: 'crystalCluster', name: 'Crystal Cluster', color: 0x8be0e8, color2: 0xe0b8ff, style: 'crystal', solid: false, hardness: 0.8, tool: 'pick', light: 9, fragile: true, needsFloor: true, opacity: 0 });
reg({ key: 'web', name: 'Silk Web', color: 0xd8d8e0, style: 'web', solid: false, hardness: 0.3, tool: 'any', hazard: { slow: 0.55 }, opacity: 0 });
reg({ key: 'spikes', name: 'Ancient Spikes', color: 0x8a8f98, style: 'plant', solid: false, hardness: 1.2, tool: 'pick', hazard: { dmg: 12 }, needsFloor: true, opacity: 0 });

// ---------------------------------------------------------------------------
// Crops (one block per growth stage, stage 0..3; stage 3 harvestable)
// ---------------------------------------------------------------------------
export interface CropFamily { key: string; name: string; color: number; yields: string; seed: string; stages: number }
export const CROPS: CropFamily[] = [
  { key: 'amberkorn', name: 'Amberkorn', color: 0xe8c84a, yields: 'amberkorn', seed: 'amberkornSeeds', stages: 4 },
  { key: 'rootstalk', name: 'Rootstalk', color: 0xc97b4a, yields: 'rootstalk', seed: 'rootstalkSeeds', stages: 4 },
  { key: 'berry', name: 'Berrybush', color: 0xb03a5f, yields: 'berries', seed: 'berrySeeds', stages: 4 },
  { key: 'glowfruit', name: 'Glowfruit', color: 0x9fe8d0, yields: 'glowfruit', seed: 'glowfruitSeeds', stages: 4 },
  { key: 'frostcap', name: 'Frostcap', color: 0xbfe8f5, yields: 'frostcap', seed: 'frostcapSeeds', stages: 4 },
  { key: 'emberpod', name: 'Emberpod', color: 0xff8a50, yields: 'emberpod', seed: 'emberpodSeeds', stages: 4 },
];
for (const c of CROPS) {
  for (let s = 0; s < c.stages; s++) {
    reg({
      key: `crop_${c.key}_${s}`,
      name: `${c.name} (stage ${s + 1})`,
      color: c.color,
      style: 'plant',
      solid: false,
      hardness: 0.05,
      tool: 'any',
      fragile: true,
      needsFloor: true,
      noItem: true,
      opacity: 0,
      drops: s === c.stages - 1 ? c.yields : c.seed,
      light: c.key === 'glowfruit' && s >= 2 ? 6 : 0,
      crop: { stages: c.stages, stage: s, yields: c.yields, yieldCount: [1, 3], seed: c.seed },
    });
  }
}

// ---------------------------------------------------------------------------
// Building material families: block + background wall + one-way platform
// ---------------------------------------------------------------------------
export interface MaterialFamily { key: string; name: string; color: number; style: BlockDef['style']; hardness: number }
export const FAMILIES: MaterialFamily[] = [
  { key: 'plank', name: 'Plank', color: 0x9c7a4a, style: 'plank', hardness: 0.7 },
  { key: 'duskPlank', name: 'Duskwood Plank', color: 0x6a5578, style: 'plank', hardness: 0.7 },
  { key: 'stoneBrick', name: 'Stone Brick', color: 0x7d828c, style: 'brick', hardness: 1.2 },
  { key: 'sandBrick', name: 'Sandstone Brick', color: 0xc2a25c, style: 'brick', hardness: 1.1 },
  { key: 'mudBrick', name: 'Mud Brick', color: 0x7a5c3d, style: 'brick', hardness: 0.9 },
  { key: 'iceBrick', name: 'Ice Brick', color: 0x9fd4e8, style: 'brick', hardness: 0.9 },
  { key: 'marble', name: 'Marble', color: 0xd8dce8, style: 'brick', hardness: 1.3 },
  { key: 'obsidianBrick', name: 'Obsidian Brick', color: 0x3a2a55, style: 'brick', hardness: 2.6 },
  { key: 'ancientBrick', name: 'Ancient Brick', color: 0xa8834f, style: 'brick', hardness: 1.8 },
  { key: 'cityBrick', name: 'Deep City Brick', color: 0x4f5a6e, style: 'brick', hardness: 1.8 },
  { key: 'copperPlate', name: 'Copper Plate', color: 0xc97b4a, style: 'plate', hardness: 1.4 },
  { key: 'ironPlate', name: 'Iron Plate', color: 0xb8b2a8, style: 'plate', hardness: 1.7 },
  { key: 'steelPlate', name: 'Steel Plate', color: 0x8f98a8, style: 'plate', hardness: 2.2 },
  { key: 'labPlate', name: 'Laboratory Panel', color: 0xa8c4c8, style: 'plate', hardness: 2.0 },
  { key: 'gearPlate', name: 'Gearwork Plate', color: 0x7d6a52, style: 'machine', hardness: 2.2 },
  { key: 'glass', name: 'Glass', color: 0xbfe0ea, style: 'glass', hardness: 0.3 },
  { key: 'crystalGlass', name: 'Prism Glass', color: 0xd0b8f0, style: 'glass', hardness: 0.5 },
  { key: 'voidTile', name: 'Void Tile', color: 0x3a3152, style: 'brick', hardness: 2.8 },
  { key: 'cloudBrick', name: 'Cloud Brick', color: 0xe8eef8, style: 'brick', hardness: 0.8 },
  { key: 'emberBrick', name: 'Ember Brick', color: 0x8a4a33, style: 'brick', hardness: 2.0 },
];
for (const f of FAMILIES) {
  const glassy = f.style === 'glass';
  reg({ key: f.key, name: f.name, color: f.color, style: f.style, hardness: f.hardness, opacity: glassy ? 1 : undefined, ...solidDefaults });
  reg({ key: `${f.key}Wall`, name: `${f.name} Wall`, color: f.color, style: f.style, solid: false, wall: true, hardness: f.hardness * 0.5, tool: 'hammer', opacity: 0 });
  reg({ key: `${f.key}Platform`, name: `${f.name} Platform`, color: f.color, style: 'platform', solid: false, platform: true, hardness: 0.3, tool: 'any', opacity: 0 });
}

// ---------------------------------------------------------------------------
// Natural background walls (generated behind terrain; hammer to remove)
// ---------------------------------------------------------------------------
const natWall = (key: string, name: string, color: number) =>
  reg({ key, name, color, style: 'wallPlain', solid: false, wall: true, hardness: 0.5, tool: 'hammer', opacity: 0, drops: null, noItem: true });
natWall('dirtWall', 'Dirt Wall', 0x53381f);
natWall('stoneWall', 'Stone Wall', 0x6a6e78);
natWall('deepWall', 'Deepstone Wall', 0x474b58);
natWall('basaltWall', 'Basalt Wall', 0x2c2833);
natWall('sandWall', 'Sandstone Wall', 0x9c7f47);
natWall('iceWall', 'Ice Wall', 0x7fb4c8);
natWall('mudWall', 'Mud Wall', 0x3e2f20);
natWall('crystalWall', 'Prismatic Wall', 0x5d5478);
natWall('ashWall', 'Ash Wall', 0x54525a);
natWall('voidWall', 'Void Wall', 0x1a1626);
natWall('rustWall', 'Rusted Wall', 0x54392a);
natWall('cloudWall', 'Cloud Wall', 0xc8d4e8);

// ---------------------------------------------------------------------------
// Light sources, furniture, storage, stations, machines
// ---------------------------------------------------------------------------
reg({ key: 'torch', name: 'Torch', color: 0xffb84a, style: 'torch', solid: false, hardness: 0.05, tool: 'any', light: 12, fragile: true, opacity: 0 });
reg({ key: 'lantern', name: 'Lantern', color: 0xffd884, style: 'torch', solid: false, hardness: 0.3, tool: 'any', light: 13, opacity: 0 });
reg({ key: 'arcLamp', name: 'Arc Lamp', color: 0xa0e8ff, style: 'machine', solid: false, hardness: 0.6, tool: 'any', light: 15, opacity: 0, furniture: 'lamp' });
reg({ key: 'campfire', name: 'Campfire', color: 0xff8a50, style: 'torch', solid: false, hardness: 0.4, tool: 'any', light: 11, needsFloor: true, furniture: 'campfire', opacity: 0 });
reg({ key: 'woodDoor', name: 'Modular Door', color: 0x8a6238, style: 'door', solid: true, hardness: 0.8, tool: 'axe', furniture: 'door', opacity: 1 });
reg({ key: 'woodDoorOpen', name: 'Modular Door (open)', color: 0x8a6238, style: 'door', solid: false, hardness: 0.8, tool: 'axe', furniture: 'door', drops: 'woodDoor', noItem: true, opacity: 0 });
reg({ key: 'chest', name: 'Chest', color: 0x9c7a4a, color2: 0xe8c84a, style: 'chest', solid: false, hardness: 0.9, tool: 'axe', furniture: 'chest', needsFloor: true, opacity: 0 });
reg({ key: 'goldChest', name: 'Gilded Chest', color: 0xb08a3a, color2: 0xffe084, style: 'chest', solid: false, hardness: 1.4, tool: 'pick', furniture: 'chest', needsFloor: true, opacity: 0 });
reg({ key: 'lootUrn', name: 'Ancient Urn', color: 0xa8834f, style: 'chest', solid: false, hardness: 0.2, tool: 'any', drops: null, noItem: true, needsFloor: true, opacity: 0 });
reg({ key: 'bed', name: 'Bed', color: 0xb03a5f, color2: 0xd8dce8, style: 'furniture', solid: false, hardness: 0.8, tool: 'axe', furniture: 'bed', needsFloor: true, opacity: 0 });
reg({ key: 'table', name: 'Table', color: 0x9c7a4a, style: 'furniture', solid: false, hardness: 0.6, tool: 'axe', furniture: 'table', needsFloor: true, opacity: 0 });
reg({ key: 'chair', name: 'Chair', color: 0x9c7a4a, style: 'furniture', solid: false, hardness: 0.5, tool: 'axe', furniture: 'chair', needsFloor: true, opacity: 0 });
reg({ key: 'rope', name: 'Rope', color: 0xc2a25c, style: 'rope', solid: false, hardness: 0.05, tool: 'any', climbable: true, opacity: 0 });
reg({ key: 'loreTablet', name: 'Lore Tablet', color: 0x8a6a45, color2: 0xe8c84a, style: 'altar', solid: false, hardness: 2.5, tool: 'pick', furniture: 'trophy', needsFloor: true, opacity: 0, drops: null, noItem: true, light: 2 });

const station = (key: string, name: string, color: number, kind: StationKind, hardness = 1) =>
  reg({ key, name, color, style: key === 'workbench' ? 'furniture' : 'machine', solid: false, hardness, tool: 'axe', furniture: 'station', station: kind, needsFloor: true, opacity: 0, light: kind === 'forge' ? 7 : kind === 'enchanting' ? 8 : 0 });
station('workbench', 'Workbench', 0x9c7a4a, 'workbench');
station('forge', 'Forge', 0x8a4a33, 'forge', 1.4);
station('kitchen', 'Cookstation', 0xb85c3a, 'kitchen', 1.2);
station('alchemyBench', 'Alchemy Bench', 0x6a8a4a, 'alchemy', 1.2);
station('engineeringTable', 'Engineering Table', 0x7d6a52, 'engineering', 1.4);
station('enchantAltar', 'Resonance Altar', 0x8a5fb0, 'enchanting', 1.8);
station('fabricator', 'Fabricator', 0x5f8fa8, 'fabricator', 2.2);

const machine = (key: string, name: string, color: number, kind: BlockDef['furniture'], light = 0) =>
  reg({ key, name, color, style: 'machine', solid: false, hardness: 1.2, tool: 'pick', furniture: kind, needsFloor: true, opacity: 0, light });
machine('generator', 'Resonance Generator', 0x5f8fa8, 'generator', 5);
machine('extractor', 'Ore Extractor', 0x7d6a52, 'extractor');
machine('sprinkler', 'Sprinkler', 0x8fa8bd, 'sprinkler');
machine('teleportAnchor', 'Teleport Anchor', 0x8a5fb0, 'teleport', 6);

// ---------------------------------------------------------------------------
// Portals & altars
// ---------------------------------------------------------------------------
export const PORTAL_DIMS = ['ancient', 'crystal', 'frozen', 'molten', 'machine', 'sky', 'void'] as const;
const FRAME_COLORS: Record<(typeof PORTAL_DIMS)[number], number> = {
  ancient: 0xd8b25e,
  crystal: 0xe0b8ff,
  frozen: 0x9ff0ff,
  molten: 0xff6a33,
  machine: 0xb8c4cc,
  sky: 0xfff0a0,
  void: 0x9a7ae8,
};
for (const d of PORTAL_DIMS) {
  reg({
    key: `frame_${d}`,
    name: `${d[0].toUpperCase() + d.slice(1)} Portal Frame`,
    color: 0x3a3540,
    color2: FRAME_COLORS[d],
    style: 'portal',
    solid: true,
    hardness: 2.0,
    tool: 'pick',
    portalTo: d,
    light: 4,
  });
}
reg({ key: 'portalCore', name: 'Portal Field', color: 0x9a7ae8, color2: 0xffffff, style: 'portal', solid: false, hardness: 0.1, tool: 'any', drops: null, noItem: true, light: 10, opacity: 0 });
reg({ key: 'voidAltar', name: 'Null Altar', color: 0x241f33, color2: 0x9a7ae8, style: 'altar', solid: false, hardness: 3.0, tool: 'pick', furniture: 'altar', needsFloor: true, light: 6, opacity: 0 });

// ---------------------------------------------------------------------------
// Painted decorative variants (dye system targets)
// ---------------------------------------------------------------------------
export const PAINTS = [
  { key: 'red', name: 'Red', color: 0xc44a4a },
  { key: 'orange', name: 'Orange', color: 0xd97f3d },
  { key: 'yellow', name: 'Yellow', color: 0xd9c23d },
  { key: 'green', name: 'Green', color: 0x4a9e4f },
  { key: 'blue', name: 'Blue', color: 0x4a6fc4 },
  { key: 'violet', name: 'Violet', color: 0x8a5fb0 },
  { key: 'white', name: 'White', color: 0xe0e4ea },
  { key: 'black', name: 'Black', color: 0x2e3138 },
] as const;
for (const p of PAINTS) {
  reg({ key: `plank_${p.key}`, name: `${p.name} Plank`, color: p.color, style: 'plank', hardness: 0.7, ...solidDefaults });
  reg({ key: `brick_${p.key}`, name: `${p.name} Brick`, color: p.color, style: 'brick', hardness: 1.2, ...solidDefaults });
}

// ---------------------------------------------------------------------------
// Registry API
// ---------------------------------------------------------------------------
export const BLOCK_DEFS: readonly BlockDef[] = defs;

export function blockId(key: string): number {
  const id = byKey.get(key);
  if (id === undefined) throw new Error(`unknown block key: ${key}`);
  return id;
}

export function blockIdOpt(key: string): number | undefined {
  return byKey.get(key);
}

export function block(id: number): BlockDef {
  return defs[id] ?? defs[AIR];
}

export function blockByKey(key: string): BlockDef {
  return defs[blockId(key)];
}

export const BLOCK_COUNT = defs.length;

/** Light attenuation per tile step (≥1). Overrides ≤1 mean "transparent". */
export function blockOpacity(id: number): number {
  const d = defs[id];
  if (!d) return 1;
  const base = d.opacity !== undefined ? d.opacity : d.solid ? 3 : 1;
  return Math.max(1, base);
}
