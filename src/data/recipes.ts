/**
 * Crafting recipes. Generated per material tier / family where regular, hand
 * authored where meaningful. Referential integrity (every in/out key exists)
 * is enforced by tests/registry.test.ts.
 */

import { FAMILIES, PAINTS } from './blocks';
import { TIERS } from './items';
import type { RecipeDef, StationKind } from './types';

const list: RecipeDef[] = [];
const r = (out: string, count: number, ins: [string, number][], station?: StationKind, flag?: string) =>
  list.push({ out, count, ins, station, flag });

// ---------------------------------------------------------------------------
// Wood & basic materials
// ---------------------------------------------------------------------------
for (const log of ['oakLog', 'pineLog', 'palmLog', 'jungleLog', 'frostLog']) r('timber', 4, [[log, 1]]);
r('timber', 4, [['duskLog', 1]]);
r('plank', 2, [['timber', 1]]);
r('duskPlank', 4, [['duskLog', 1]]);
r('stoneBrick', 4, [['stone', 4]]);
r('sandBrick', 4, [['sandstone', 4]]);
r('mudBrick', 4, [['mud', 4]]);
r('iceBrick', 4, [['ice', 4]]);
r('marble', 4, [['stone', 4], ['prismDust', 1]], 'workbench');
r('obsidianBrick', 4, [['obsidian', 4]], 'forge');
r('ancientBrick', 4, [['ancientSoil', 2], ['stone', 2]], 'workbench');
r('cityBrick', 4, [['deepstone', 4]], 'workbench');
r('copperPlate', 2, [['copperBar', 1]], 'forge');
r('ironPlate', 2, [['ironBar', 1]], 'forge');
r('steelPlate', 2, [['steelBar', 1]], 'forge');
r('labPlate', 2, [['ironBar', 1], ['glass', 1]], 'engineering');
r('gearPlate', 2, [['gearScrap', 1], ['ironBar', 1]], 'engineering');
r('glass', 2, [['sand', 2]], 'forge');
r('crystalGlass', 2, [['glass', 2], ['prismDust', 1]], 'forge');
r('voidTile', 4, [['voidrock', 4]], 'fabricator');
r('cloudBrick', 4, [['cloudstone', 4]]);
r('emberBrick', 4, [['scorchstone', 4]], 'forge');
r('prismDust', 2, [['crystalOre', 1]], 'forge');

// Walls & platforms for every material family
for (const f of FAMILIES) {
  r(`${f.key}Wall`, 4, [[f.key, 1]], 'workbench');
  r(`${f.key}Platform`, 4, [[f.key, 1]]);
}

// ---------------------------------------------------------------------------
// Smelting
// ---------------------------------------------------------------------------
r('copperBar', 1, [['copperOre', 3]], 'forge');
r('ironBar', 1, [['ironOre', 3]], 'forge');
r('silverBar', 1, [['silverOre', 3]], 'forge');
r('goldBar', 1, [['goldOre', 3]], 'forge');
r('steelBar', 1, [['ironBar', 2], ['coalOre', 2]], 'forge');
r('meteoricBar', 1, [['meteoricOre', 3]], 'forge');
r('relictiumBar', 1, [['relictiumOre', 3]], 'forge');
r('prismiteBar', 1, [['prismiteOre', 3]], 'forge');
r('cryostalBar', 1, [['cryostalOre', 3]], 'forge');
r('magmiteBar', 1, [['magmiteOre', 3]], 'fabricator');
r('ferroxBar', 1, [['ferroxOre', 3]], 'fabricator');
r('auraliteBar', 1, [['auraliteOre', 3]], 'forge');
r('voidglassBar', 1, [['voidglassOre', 3]], 'fabricator');

// ---------------------------------------------------------------------------
// Tools / weapons / armor per tier
// ---------------------------------------------------------------------------
for (const t of TIERS) {
  const station: StationKind | undefined = t.rarity >= 3 ? 'fabricator' : t.rarity >= 1 ? 'forge' : 'workbench';
  const bar = t.bar;
  r(`${t.key}Pick`, 1, [[bar, 8], ['timber', 3]], station);
  r(`${t.key}Axe`, 1, [[bar, 6], ['timber', 2]], station);
  r(`${t.key}Sword`, 1, [[bar, 7], ['timber', 1]], station);
  r(`${t.key}Spear`, 1, [[bar, 7], ['timber', 2]], station);
  if (['wood', 'iron', 'meteoric', 'relictium', 'auralite', 'voidglass'].includes(t.key)) {
    r(`${t.key}Bow`, 1, [[bar, 6], ['plantFiber', 3]], station);
  }
  if (t.magic) r(`${t.key}Wand`, 1, [[bar, 6], ['prismDust', 2]], 'enchanting');
  if (t.key !== 'wood' && t.key !== 'stone') {
    r(`${t.key}Helmet`, 1, [[bar, 8]], station);
    r(`${t.key}Chestplate`, 1, [[bar, 12]], station);
    r(`${t.key}Greaves`, 1, [[bar, 10]], station);
  }
  if (['iron', 'steel'].includes(t.key)) {
    r(`${t.key}Hoe`, 1, [[bar, 5], ['timber', 2]], station);
    r(`${t.key}Hammer`, 1, [[bar, 6], ['timber', 2]], station);
  }
}
r('woodHoe', 1, [['timber', 5]]);
r('woodHammer', 1, [['timber', 6]]);

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------
r('workbench', 1, [['timber', 8]]);
r('forge', 1, [['stone', 20], ['torch', 3], ['coalOre', 5]], 'workbench');
r('kitchen', 1, [['stone', 10], ['timber', 6], ['copperBar', 2]], 'workbench');
r('alchemyBench', 1, [['timber', 8], ['glass', 4]], 'workbench');
r('engineeringTable', 1, [['ironBar', 6], ['timber', 8]], 'workbench');
r('enchantAltar', 1, [['marble', 8], ['prismDust', 6]], 'workbench');
r('fabricator', 1, [['steelBar', 8], ['circuit', 4], ['gearScrap', 6]], 'engineering');

// ---------------------------------------------------------------------------
// Furniture, light, utility
// ---------------------------------------------------------------------------
r('torch', 4, [['timber', 1], ['coalOre', 1]]);
r('lantern', 1, [['ironBar', 2], ['glass', 2], ['torch', 1]], 'workbench');
r('campfire', 1, [['timber', 5], ['stone', 5]]);
r('arcLamp', 1, [['circuit', 2], ['glass', 3], ['steelBar', 1]], 'engineering');
r('woodDoor', 1, [['timber', 6]], 'workbench');
r('chest', 1, [['timber', 8], ['copperBar', 1]], 'workbench');
r('goldChest', 1, [['chest', 1], ['goldBar', 8]], 'workbench');
r('bed', 1, [['timber', 10], ['plantFiber', 8]], 'workbench');
r('table', 1, [['timber', 6]], 'workbench');
r('chair', 1, [['timber', 4]], 'workbench');
r('rope', 10, [['plantFiber', 3]]);
r('emptyBucket', 1, [['ironBar', 3]], 'forge');

// Machines
r('circuit', 1, [['copperBar', 2], ['prismDust', 1]], 'engineering');
r('generator', 1, [['steelBar', 6], ['circuit', 3]], 'engineering');
r('extractor', 1, [['steelBar', 4], ['gearScrap', 4], ['circuit', 2]], 'engineering');
r('sprinkler', 1, [['copperBar', 4], ['glass', 2]], 'engineering');
r('teleportAnchor', 2, [['prismiteBar', 4], ['circuit', 4]], 'fabricator');

// ---------------------------------------------------------------------------
// Ammo & throwables
// ---------------------------------------------------------------------------
r('arrow', 8, [['timber', 1], ['gravel', 1]]);
r('emberArrow', 8, [['arrow', 8], ['emberBud', 1]]);
r('frostArrow', 8, [['arrow', 8], ['iceShard', 1]]);
r('throwingStone', 10, [['stone', 2]]);

// ---------------------------------------------------------------------------
// Alchemy
// ---------------------------------------------------------------------------
r('healingDraughtS', 2, [['glass', 1], ['berries', 3]], 'alchemy');
r('healingDraughtM', 1, [['healingDraughtS', 2], ['prismDust', 1]], 'alchemy');
r('healingDraughtL', 1, [['healingDraughtM', 2], ['essenceVoid', 1]], 'alchemy');
r('manaDraught', 2, [['glass', 1], ['crystalOre', 1]], 'alchemy');
r('regenBrew', 1, [['glass', 1], ['berries', 2], ['glowfruit', 1]], 'alchemy');
r('ironhideBrew', 1, [['glass', 1], ['ironOre', 2]], 'alchemy');
r('swiftnessBrew', 1, [['glass', 1], ['featherGale', 1]], 'alchemy');
r('nightsightBrew', 1, [['glass', 1], ['glowshroom', 2]], 'alchemy');
r('warmthBrew', 1, [['glass', 1], ['emberBud', 2]], 'alchemy');
r('coolingBrew', 1, [['glass', 1], ['iceShard', 2]], 'alchemy');
r('featherBrew', 1, [['glass', 1], ['featherGale', 2]], 'alchemy');
r('gillsBrew', 1, [['glass', 1], ['plasm', 3]], 'alchemy');
r('battleBrew', 1, [['glass', 1], ['fang', 3], ['essenceEmber', 1]], 'alchemy');
r('antidote', 2, [['glass', 1], ['mushroom', 2]], 'alchemy');

// ---------------------------------------------------------------------------
// Kitchen
// ---------------------------------------------------------------------------
r('cookedMeat', 1, [['rawMeat', 1]], 'kitchen');
r('bread', 2, [['amberkorn', 3]], 'kitchen');
r('stew', 1, [['rootstalk', 2], ['rawMeat', 1]], 'kitchen');
r('berryPie', 1, [['berries', 4], ['amberkorn', 2]], 'kitchen');
r('glowJam', 2, [['glowfruit', 3], ['glass', 1]], 'kitchen');
r('frostSorbet', 1, [['frostcap', 3], ['snow', 2]], 'kitchen');
r('emberChili', 1, [['emberpod', 3], ['rawMeat', 1]], 'kitchen');
r('travelRations', 2, [['bread', 1], ['berries', 2], ['cookedMeat', 1]], 'kitchen');

// ---------------------------------------------------------------------------
// Dyes & painted blocks
// ---------------------------------------------------------------------------
const dyeSources: Record<string, [string, number]> = {
  red: ['flowerRed', 2],
  orange: ['emberBud', 2],
  yellow: ['flowerYellow', 2],
  green: ['fern', 2],
  blue: ['flowerBlue', 2],
  violet: ['voidBloom', 2],
  white: ['boneShard', 2],
  black: ['coalOre', 2],
};
for (const p of PAINTS) {
  r(`dye_${p.key}`, 2, [dyeSources[p.key]], 'alchemy');
  r(`plank_${p.key}`, 8, [['plank', 8], [`dye_${p.key}`, 1]], 'workbench');
  r(`brick_${p.key}`, 8, [['stoneBrick', 8], [`dye_${p.key}`, 1]], 'workbench');
}

// ---------------------------------------------------------------------------
// Accessories
// ---------------------------------------------------------------------------
r('swiftBand', 1, [['hide', 4], ['silverBar', 2]], 'workbench');
r('leapCharm', 1, [['plasm', 6], ['silverBar', 2]], 'workbench');
r('featherSigil', 1, [['featherGale', 4], ['goldBar', 3]], 'enchanting');
r('ironSkinRing', 1, [['ironBar', 5]], 'forge');
r('eagleEye', 1, [['fang', 4], ['goldBar', 3]], 'enchanting');
r('manaLoop', 1, [['crystalOre', 6], ['silverBar', 3]], 'enchanting');
r('enduranceKnot', 1, [['hide', 5], ['plantFiber', 10]], 'workbench');
r('emberheart', 1, [['essenceEmber', 3], ['goldBar', 2]], 'enchanting');
r('coolantCell', 1, [['essenceFrost', 3], ['glass', 4]], 'engineering');
r('gillPendant', 1, [['plasm', 8], ['silverBar', 2]], 'enchanting');
r('lightCore', 1, [['glowshroom', 6], ['crystalOre', 4]], 'enchanting');
r('magnetCoil', 1, [['ironBar', 4], ['circuit', 1]], 'engineering');
r('thornBand', 1, [['cactus', 8], ['fang', 3]], 'workbench');

// ---------------------------------------------------------------------------
// Progression: summons, attunement, portal frames
// ---------------------------------------------------------------------------
r('resonantSigil', 1, [['boneShard', 5], ['prismDust', 3], ['goldBar', 2]], 'enchanting');
r('umbralLens', 1, [['glass', 5], ['prismDust', 5], ['wardenCore', 1]], 'enchanting', 'boss.warden');
r('nullBeacon', 1, [['voidglassBar', 3], ['essenceVoid', 5]], 'enchanting');
r('attunementCore', 1, [['wardenCore', 1], ['crystalOre', 4]], 'enchanting', 'boss.warden');

r('frame_ancient', 12, [['stoneBrick', 12], ['attunementCore', 1]], 'enchanting', 'boss.warden');
r('frame_crystal', 12, [['crystalOre', 8], ['relictiumBar', 2], ['attunementCore', 1]], 'enchanting');
r('frame_frozen', 12, [['ice', 12], ['prismiteBar', 2], ['attunementCore', 1]], 'enchanting');
r('frame_molten', 12, [['obsidian', 8], ['cryostalBar', 2], ['attunementCore', 1]], 'enchanting');
r('frame_machine', 12, [['ironPlate', 8], ['magmiteBar', 2], ['attunementCore', 1]], 'enchanting');
r('frame_sky', 12, [['cloudstone', 12], ['ferroxBar', 2], ['attunementCore', 1]], 'enchanting');
r('frame_void', 12, [['obsidianBrick', 12], ['auraliteBar', 2], ['essenceTime', 1], ['attunementCore', 1]], 'enchanting');
r('voidAltar', 1, [['voidrock', 10], ['essenceVoid', 3]], 'fabricator');

// Summon staves & uniques
r('plasmStaff', 1, [['plasm', 10], ['timber', 6]], 'workbench');
r('gearStaff', 1, [['gearScrap', 8], ['circuit', 3], ['essenceVoid', 1]], 'fabricator');

export const RECIPES: readonly RecipeDef[] = list;
