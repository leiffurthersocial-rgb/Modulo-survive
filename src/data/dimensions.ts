/** Biome and dimension definitions. One parameterized generator serves all eight worlds. */

import type { BiomeDef, DimensionDef } from './types';

// ---------------------------------------------------------------------------
// Biomes
// ---------------------------------------------------------------------------
const biomes: BiomeDef[] = [
  // Overworld surface (selected by temperature/humidity)
  { key: 'meadow', name: 'Meadow', temp: 0.1, humid: 0.0, topsoil: 'grass', subsoil: 'dirt', treeDensity: 0.10, treeSpecies: 'oak', ambient: 18, parallaxHue: 0x58b04c, weather: ['rain', 'fog'] },
  { key: 'forest', name: 'Deep Forest', temp: 0.0, humid: 0.45, topsoil: 'grass', subsoil: 'dirt', treeDensity: 0.34, treeSpecies: 'oak', ambient: 16, parallaxHue: 0x2f6b4f, weather: ['rain', 'fog'] },
  { key: 'jungle', name: 'Dense Jungle', temp: 0.55, humid: 0.7, topsoil: 'jungleGrass', subsoil: 'mud', treeDensity: 0.44, treeSpecies: 'jungle', ambient: 28, parallaxHue: 0x2f9e44, weather: ['rain', 'storm'] },
  { key: 'desert', name: 'Desert', temp: 0.7, humid: -0.6, topsoil: 'sand', subsoil: 'sand', treeDensity: 0.03, treeSpecies: 'palm', ambient: 36, parallaxHue: 0xc2a25c, weather: ['sandstorm'] },
  { key: 'snowfields', name: 'Snowfields', temp: -0.65, humid: 0.1, topsoil: 'snowGrass', subsoil: 'dirt', treeDensity: 0.16, treeSpecies: 'pine', ambient: -8, parallaxHue: 0x9fd4e8, weather: ['snow', 'fog'] },
  { key: 'mountains', name: 'Mountains', temp: -0.25, humid: -0.2, topsoil: 'stone', subsoil: 'stone', treeDensity: 0.06, treeSpecies: 'pine', ambient: 4, parallaxHue: 0x8a8f98, weather: ['snow', 'fog', 'rain'] },
  { key: 'volcanic', name: 'Volcanic Wastes', temp: 0.9, humid: -0.3, topsoil: 'ash', subsoil: 'scorchstone', treeDensity: 0.02, treeSpecies: 'dusk', ambient: 44, parallaxHue: 0x59372e, weather: ['ashfall'] },
  // Underground biomes (selected by depth + region noise, any dimension)
  { key: 'crystalCavern', name: 'Crystal Caverns', temp: 0, humid: 0, topsoil: 'crystalRock', subsoil: 'crystalRock', treeDensity: 0, ambient: 10, parallaxHue: 0x8be0e8, weather: [] },
  { key: 'fungalHollow', name: 'Fungal Hollows', temp: 0, humid: 0.8, topsoil: 'mycelium', subsoil: 'mud', treeDensity: 0, ambient: 14, parallaxHue: 0xb08ad0, weather: [] },
  // Dimension surface biomes
  { key: 'ancientWaste', name: 'Ancient Waste', temp: 0.5, humid: -0.5, topsoil: 'ancientSoil', subsoil: 'ancientSoil', treeDensity: 0.05, treeSpecies: 'dusk', ambient: 30, parallaxHue: 0xa8834f, weather: ['sandstorm', 'fog'] },
  { key: 'crystalFields', name: 'Crystal Fields', temp: 0, humid: 0, topsoil: 'crystalRock', subsoil: 'crystalRock', treeDensity: 0.08, treeSpecies: 'dusk', ambient: 12, parallaxHue: 0xe0b8ff, weather: ['fog'] },
  { key: 'frozenExpanse', name: 'Frozen Expanse', temp: -0.9, humid: 0.2, topsoil: 'snow', subsoil: 'permafrost', treeDensity: 0.10, treeSpecies: 'frost', ambient: -24, parallaxHue: 0x9ff0ff, weather: ['snow', 'aurora'] },
  { key: 'moltenReach', name: 'Molten Reach', temp: 1, humid: -0.8, topsoil: 'scorchstone', subsoil: 'basalt', treeDensity: 0.01, treeSpecies: 'dusk', ambient: 55, parallaxHue: 0xff6a33, weather: ['ashfall'] },
  { key: 'machineWorks', name: 'The Works', temp: 0.3, humid: -0.2, topsoil: 'rustplate', subsoil: 'rustplate', treeDensity: 0.02, treeSpecies: 'dusk', ambient: 26, parallaxHue: 0x6e4a33, weather: ['fog'] },
  { key: 'skyIsles', name: 'Sky Isles', temp: -0.1, humid: 0.3, topsoil: 'grass', subsoil: 'cloudstone', treeDensity: 0.14, treeSpecies: 'oak', ambient: 8, parallaxHue: 0xdfe8f5, weather: ['rain', 'fog'] },
  { key: 'voidExpanse', name: 'Void Expanse', temp: -0.4, humid: -0.9, topsoil: 'voidrock', subsoil: 'voidrock', treeDensity: 0.03, treeSpecies: 'dusk', ambient: -4, parallaxHue: 0x3a3152, weather: [] },
];

const biomeMap = new Map(biomes.map((b) => [b.key, b]));
export const BIOME_DEFS: readonly BiomeDef[] = biomes;
export function biomeByKey(key: string): BiomeDef {
  const b = biomeMap.get(key);
  if (!b) throw new Error(`unknown biome: ${key}`);
  return b;
}

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------
const dims: DimensionDef[] = [
  {
    key: 'overworld', name: 'The Keystone', surfaceBase: 200, amplitude: 1, caveDensity: 1,
    biomes: ['meadow', 'forest', 'jungle', 'desert', 'snowfields', 'mountains', 'volcanic'],
    stone: 'stone', liquid: 'water', skyTop: 0x3a6ea8, skyBottom: 0x9fd4e8, skyLight: 1,
    exclusiveOre: 'crystalOre', ambient: 18, musicKey: 'keystone', weather: ['rain', 'storm', 'snow', 'sandstorm', 'fog'],
    terrainMode: 'columns', frameBlock: '',
  },
  {
    key: 'ancient', name: 'Ancient Stratum', surfaceBase: 210, amplitude: 0.7, caveDensity: 1.15,
    biomes: ['ancientWaste'], stone: 'sandstone', liquid: 'water', skyTop: 0x8a5a2e, skyBottom: 0xd8b25e, skyLight: 0.9,
    exclusiveOre: 'relictiumOre', ambient: 30, musicKey: 'ancient', weather: ['sandstorm', 'fog'],
    terrainMode: 'columns', bossKey: 'bossWarden', frameBlock: 'frame_ancient',
  },
  {
    key: 'crystal', name: 'Crystal Stratum', surfaceBase: 205, amplitude: 1.1, caveDensity: 1.35,
    biomes: ['crystalFields'], stone: 'crystalRock', liquid: 'water', skyTop: 0x4a3a6e, skyBottom: 0xc9b8f0, skyLight: 0.85,
    exclusiveOre: 'prismiteOre', ambient: 12, musicKey: 'crystal', weather: ['fog'],
    terrainMode: 'columns', bossKey: 'bossRefractor', frameBlock: 'frame_crystal',
  },
  {
    key: 'frozen', name: 'Frozen Stratum', surfaceBase: 195, amplitude: 1.2, caveDensity: 0.9,
    biomes: ['frozenExpanse'], stone: 'permafrost', liquid: 'water', skyTop: 0x1e3a52, skyBottom: 0x9ff0ff, skyLight: 0.8,
    exclusiveOre: 'cryostalOre', ambient: -24, musicKey: 'frozen', weather: ['snow', 'aurora'],
    terrainMode: 'columns', bossKey: 'bossBorea', frameBlock: 'frame_frozen',
  },
  {
    key: 'molten', name: 'Molten Stratum', surfaceBase: 215, amplitude: 0.9, caveDensity: 1.3,
    biomes: ['moltenReach'], stone: 'scorchstone', liquid: 'lava', skyTop: 0x2e1414, skyBottom: 0xff6a33, skyLight: 0.7,
    exclusiveOre: 'magmiteOre', ambient: 55, musicKey: 'molten', weather: ['ashfall'],
    terrainMode: 'columns', bossKey: 'bossPyraxis', frameBlock: 'frame_molten',
  },
  {
    key: 'machine', name: 'Machine Stratum', surfaceBase: 205, amplitude: 0.6, caveDensity: 1.5,
    biomes: ['machineWorks'], stone: 'rustplate', liquid: 'water', skyTop: 0x33261e, skyBottom: 0x9c6b45, skyLight: 0.75,
    exclusiveOre: 'ferroxOre', ambient: 26, musicKey: 'machine', weather: ['fog'],
    terrainMode: 'columns', bossKey: 'bossFabrik', frameBlock: 'frame_machine',
  },
  {
    key: 'sky', name: 'Sky Stratum', surfaceBase: 240, amplitude: 1, caveDensity: 0.6,
    biomes: ['skyIsles'], stone: 'cloudstone', liquid: 'water', skyTop: 0x4a7fc4, skyBottom: 0xdfe8f5, skyLight: 1,
    exclusiveOre: 'auraliteOre', ambient: 8, musicKey: 'sky', weather: ['rain', 'fog'],
    terrainMode: 'islands', bossKey: 'bossZephyr', frameBlock: 'frame_sky',
  },
  {
    key: 'void', name: 'Void Stratum', surfaceBase: 230, amplitude: 1.1, caveDensity: 0.8,
    biomes: ['voidExpanse'], stone: 'voidrock', liquid: 'none', skyTop: 0x0b0a14, skyBottom: 0x241f33, skyLight: 0.35,
    exclusiveOre: 'voidglassOre', ambient: -4, musicKey: 'void', weather: [],
    terrainMode: 'islands', bossKey: 'bossNull', frameBlock: 'frame_void',
  },
];

const dimMap = new Map(dims.map((d) => [d.key, d]));
export const DIMENSION_DEFS: readonly DimensionDef[] = dims;
export function dimensionByKey(key: string): DimensionDef {
  const d = dimMap.get(key);
  if (!d) throw new Error(`unknown dimension: ${key}`);
  return d;
}
