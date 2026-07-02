/**
 * Item registry. Every placeable block auto-registers a corresponding item;
 * tools/weapons/armor are generated per material tier so all ~350 entries are
 * functional (real stats, real recipes) — no filler content.
 */

import { BLOCK_DEFS, CROPS, PAINTS } from './blocks';
import type { IconSpec, ItemDef, ProjectileSpec, Rarity } from './types';

const defs: ItemDef[] = [];
const byKey = new Map<string, number>();

function reg(def: ItemDef): ItemDef {
  if (byKey.has(def.key)) throw new Error(`duplicate item key: ${def.key}`);
  byKey.set(def.key, defs.length);
  defs.push(def);
  return def;
}

// ---------------------------------------------------------------------------
// Auto items for placeable blocks
// ---------------------------------------------------------------------------
for (const b of BLOCK_DEFS) {
  if (b.noItem || b.key === 'air') continue;
  reg({
    key: b.key,
    name: b.name,
    kind: b.wall ? 'wall' : 'block',
    rarity: b.portalTo ? 2 : b.light && b.light > 8 ? 1 : 0,
    maxStack: 999,
    value: Math.max(1, Math.round(b.hardness * 4 + (b.light ?? 0))),
    block: b.key,
    icon: { shape: 'block', color: b.color, color2: b.color2 },
  });
}

// ---------------------------------------------------------------------------
// Core materials
// ---------------------------------------------------------------------------
const mat = (key: string, name: string, color: number, value: number, rarity: Rarity = 0, shape: IconSpec['shape'] = 'part', desc?: string) =>
  reg({ key, name, desc, kind: 'material', rarity, maxStack: 999, value, icon: { shape, color } });

mat('timber', 'Timber', 0x9c7a4a, 1, 0, 'part', 'Worked wood, the universal ingredient.');
mat('plantFiber', 'Plant Fiber', 0x58b04c, 1);
mat('silkThread', 'Silk Thread', 0xd8d8e0, 3);
mat('plasm', 'Plasm', 0x7fd0e8, 2, 0, 'gem', 'Wobbling residue of a hopper.');
mat('hide', 'Tough Hide', 0x8a6238, 3);
mat('fang', 'Fang', 0xe8e4da, 3);
mat('boneShard', 'Bone Shard', 0xd8d4c8, 3);
mat('featherGale', 'Gale Feather', 0xfff0a0, 6, 1);
mat('gearScrap', 'Gear Scrap', 0x8f8a80, 5, 1, 'part', 'Machine-stratum salvage.');
mat('circuit', 'Resonant Circuit', 0x5f8fa8, 14, 1);
mat('prismDust', 'Prism Dust', 0xe0b8ff, 8, 1, 'gem');
mat('essenceFrost', 'Frost Essence', 0x9ff0ff, 10, 2, 'gem');
mat('essenceEmber', 'Ember Essence', 0xff8a50, 10, 2, 'gem');
mat('essenceVoid', 'Void Essence', 0x9a7ae8, 14, 3, 'gem');
mat('essenceTime', 'Crystallized Hour', 0xe8c84a, 18, 3, 'gem', 'The Chronophage drops what it cannot digest.');
mat('wardenCore', 'Warden Core', 0xd8b25e, 60, 3, 'gem', 'Still humming with seal-resonance.');
mat('chronoHeart', 'Chrono Heart', 0xe8c84a, 80, 4, 'gem');
mat('nullCrown', 'Null Crown Shard', 0x9a7ae8, 120, 4, 'gem');
mat('attunementCore', 'Attunement Core', 0xffffff, 40, 2, 'gem', 'Keys a portal frame to its stratum.');
mat('rawMeat', 'Raw Meat', 0xc4574f, 2, 0, 'food');

const bar = (key: string, name: string, color: number, value: number, rarity: Rarity = 0) =>
  reg({ key, name, kind: 'material', rarity, maxStack: 999, value, icon: { shape: 'bar', color } });

bar('copperBar', 'Copper Bar', 0xc97b4a, 6);
bar('ironBar', 'Iron Bar', 0xc9b7a5, 10);
bar('silverBar', 'Silver Bar', 0xd8dee8, 14, 1);
bar('goldBar', 'Gold Bar', 0xe8c84a, 20, 1);
bar('steelBar', 'Steel Bar', 0x8f98a8, 24, 1);
bar('meteoricBar', 'Meteoric Bar', 0xff8a50, 36, 2);
bar('relictiumBar', 'Relictium Bar', 0xd8b25e, 48, 2);
bar('prismiteBar', 'Prismite Bar', 0xe0b8ff, 48, 2);
bar('cryostalBar', 'Cryostal Bar', 0x9ff0ff, 48, 2);
bar('magmiteBar', 'Magmite Bar', 0xff6a33, 56, 3);
bar('ferroxBar', 'Ferrox Bar', 0xb8c4cc, 56, 3);
bar('auraliteBar', 'Auralite Bar', 0xfff0a0, 48, 2);
bar('voidglassBar', 'Voidglass Bar', 0x9a7ae8, 72, 3);

// ---------------------------------------------------------------------------
// Material tiers → tools, weapons, armor
// ---------------------------------------------------------------------------
export interface Tier {
  key: string;
  name: string;
  color: number;
  bar: string; // ingredient item
  power: number; // tool power (gates minPower blocks)
  speed: number; // tool/attack speed multiplier
  dmg: number; // weapon base damage
  def: number; // armor defense per piece
  rarity: Rarity;
  magic?: boolean; // gets a wand
  warmth?: number; // armor warmth per piece
}

export const TIERS: Tier[] = [
  { key: 'wood', name: 'Wooden', color: 0x9c7a4a, bar: 'timber', power: 1, speed: 1.0, dmg: 7, def: 1, rarity: 0 },
  { key: 'stone', name: 'Stone', color: 0x8a8f98, bar: 'stone', power: 1, speed: 1.1, dmg: 9, def: 1, rarity: 0 },
  { key: 'copper', name: 'Copper', color: 0xc97b4a, bar: 'copperBar', power: 1, speed: 1.25, dmg: 12, def: 2, rarity: 0 },
  { key: 'iron', name: 'Iron', color: 0xc9b7a5, bar: 'ironBar', power: 2, speed: 1.4, dmg: 16, def: 3, rarity: 1 },
  { key: 'steel', name: 'Steel', color: 0x8f98a8, bar: 'steelBar', power: 3, speed: 1.6, dmg: 22, def: 4, rarity: 1 },
  { key: 'meteoric', name: 'Meteoric', color: 0xff8a50, bar: 'meteoricBar', power: 4, speed: 1.8, dmg: 30, def: 5, rarity: 2, magic: true },
  { key: 'relictium', name: 'Relictium', color: 0xd8b25e, bar: 'relictiumBar', power: 5, speed: 2.0, dmg: 38, def: 6, rarity: 2, magic: true },
  { key: 'prismite', name: 'Prismite', color: 0xe0b8ff, bar: 'prismiteBar', power: 5, speed: 2.1, dmg: 40, def: 6, rarity: 2, magic: true },
  { key: 'cryostal', name: 'Cryostal', color: 0x9ff0ff, bar: 'cryostalBar', power: 5, speed: 2.1, dmg: 40, def: 6, rarity: 2, magic: true, warmth: 2 },
  { key: 'auralite', name: 'Auralite', color: 0xfff0a0, bar: 'auraliteBar', power: 5, speed: 2.2, dmg: 42, def: 6, rarity: 2, magic: true },
  { key: 'magmite', name: 'Magmite', color: 0xff6a33, bar: 'magmiteBar', power: 5, speed: 2.2, dmg: 48, def: 7, rarity: 3, magic: true },
  { key: 'ferrox', name: 'Ferrox', color: 0xb8c4cc, bar: 'ferroxBar', power: 5, speed: 2.3, dmg: 48, def: 8, rarity: 3 },
  { key: 'voidglass', name: 'Voidglass', color: 0x9a7ae8, bar: 'voidglassBar', power: 6, speed: 2.5, dmg: 60, def: 9, rarity: 4, magic: true },
];

const boltFor = (t: Tier): ProjectileSpec => ({
  look: t.key === 'cryostal' ? 'shard' : t.key === 'magmite' ? 'flame' : 'bolt',
  speed: 26,
  gravity: 0,
  pierce: t.rarity >= 3 ? 2 : 1,
  color: t.color,
  status:
    t.key === 'cryostal'
      ? { key: 'freezing', duration: 2.5, chance: 0.5 }
      : t.key === 'magmite'
        ? { key: 'burning', duration: 3, chance: 0.5 }
        : undefined,
});

for (const t of TIERS) {
  const v = (m: number) => Math.round((t.dmg + t.power * 6) * m);
  reg({ key: `${t.key}Pick`, name: `${t.name} Pickaxe`, kind: 'tool', rarity: t.rarity, maxStack: 1, value: v(2), tool: { type: 'pick', power: t.power, speed: t.speed }, icon: { shape: 'pick', color: t.color } });
  reg({ key: `${t.key}Axe`, name: `${t.name} Axe`, kind: 'tool', rarity: t.rarity, maxStack: 1, value: v(1.8), tool: { type: 'axe', power: t.power, speed: t.speed }, icon: { shape: 'axe', color: t.color } });
  reg({ key: `${t.key}Sword`, name: `${t.name} Sword`, kind: 'weapon', rarity: t.rarity, maxStack: 1, value: v(2.2), weapon: { type: 'sword', dmg: t.dmg, speed: 1.6 * Math.sqrt(t.speed), knockback: 5 }, icon: { shape: 'sword', color: t.color } });
  reg({ key: `${t.key}Spear`, name: `${t.name} Spear`, kind: 'weapon', rarity: t.rarity, maxStack: 1, value: v(2.2), weapon: { type: 'spear', dmg: Math.round(t.dmg * 0.85), speed: 1.2 * Math.sqrt(t.speed), knockback: 7 }, icon: { shape: 'spear', color: t.color } });
  if (['wood', 'iron', 'meteoric', 'relictium', 'auralite', 'voidglass'].includes(t.key)) {
    reg({ key: `${t.key}Bow`, name: `${t.name} Bow`, kind: 'weapon', rarity: t.rarity, maxStack: 1, value: v(2.2), weapon: { type: 'bow', dmg: Math.round(t.dmg * 0.9), speed: 1.3, knockback: 3, critBonus: 0.04 }, icon: { shape: 'bow', color: t.color } });
  }
  if (t.magic) {
    reg({ key: `${t.key}Wand`, name: `${t.name} Wand`, kind: 'weapon', rarity: t.rarity, maxStack: 1, value: v(2.6), weapon: { type: 'wand', dmg: Math.round(t.dmg * 1.05), speed: 1.8, knockback: 2, mana: 7, projectile: boltFor(t) }, icon: { shape: 'wand', color: t.color } });
  }
  if (t.key !== 'wood' && t.key !== 'stone') {
    const w = t.warmth;
    reg({ key: `${t.key}Helmet`, name: `${t.name} Helmet`, kind: 'armor', rarity: t.rarity, maxStack: 1, value: v(1.6), armor: { slot: 'head', defense: t.def, warmth: w }, icon: { shape: 'helmet', color: t.color } });
    reg({ key: `${t.key}Chestplate`, name: `${t.name} Chestplate`, kind: 'armor', rarity: t.rarity, maxStack: 1, value: v(2.4), armor: { slot: 'chest', defense: t.def + 1, warmth: w }, icon: { shape: 'chestplate', color: t.color } });
    reg({ key: `${t.key}Greaves`, name: `${t.name} Greaves`, kind: 'armor', rarity: t.rarity, maxStack: 1, value: v(1.9), armor: { slot: 'legs', defense: t.def, warmth: w }, icon: { shape: 'legs', color: t.color } });
  }
  if (['iron', 'steel'].includes(t.key)) {
    reg({ key: `${t.key}Hoe`, name: `${t.name} Hoe`, kind: 'tool', rarity: t.rarity, maxStack: 1, value: v(1.2), tool: { type: 'hoe', power: t.power, speed: t.speed }, icon: { shape: 'hoe', color: t.color } });
    reg({ key: `${t.key}Hammer`, name: `${t.name} Hammer`, kind: 'tool', rarity: t.rarity, maxStack: 1, value: v(1.5), tool: { type: 'hammer', power: t.power, speed: t.speed }, icon: { shape: 'hammer', color: t.color } });
  }
}

// Starter-tier extras (wooden hoe/hammer so early game has wall/farm access)
reg({ key: 'woodHoe', name: 'Wooden Hoe', kind: 'tool', rarity: 0, maxStack: 1, value: 6, tool: { type: 'hoe', power: 1, speed: 1 }, icon: { shape: 'hoe', color: 0x9c7a4a } });
reg({ key: 'woodHammer', name: 'Wooden Hammer', kind: 'tool', rarity: 0, maxStack: 1, value: 6, tool: { type: 'hammer', power: 1, speed: 1 }, icon: { shape: 'hammer', color: 0x9c7a4a } });

// ---------------------------------------------------------------------------
// Unique weapons (boss / structure loot)
// ---------------------------------------------------------------------------
reg({ key: 'wardenHammer', name: 'Warden’s Hammer', desc: 'Slams with seal-force.', kind: 'weapon', rarity: 3, maxStack: 1, value: 220, weapon: { type: 'sword', dmg: 42, speed: 0.9, knockback: 11 }, icon: { shape: 'hammer', color: 0xd8b25e } });
reg({ key: 'chronoBlade', name: 'Chrono Blade', desc: 'Strikes between the seconds.', kind: 'weapon', rarity: 4, maxStack: 1, value: 320, weapon: { type: 'sword', dmg: 38, speed: 2.6, knockback: 4, critBonus: 0.1 }, icon: { shape: 'sword', color: 0xe8c84a } });
reg({ key: 'nullScepter', name: 'Null Scepter', desc: 'Casts what the Void forgot.', kind: 'weapon', rarity: 4, maxStack: 1, value: 400, weapon: { type: 'wand', dmg: 55, speed: 2.0, knockback: 3, mana: 9, projectile: { look: 'orb', speed: 22, gravity: 0, pierce: 3, homing: 2.2, color: 0x9a7ae8 } }, icon: { shape: 'wand', color: 0x9a7ae8 } });
reg({ key: 'galePiercer', name: 'Gale Piercer', desc: 'A bow strung with wind.', kind: 'weapon', rarity: 3, maxStack: 1, value: 260, weapon: { type: 'bow', dmg: 34, speed: 2.2, knockback: 3, critBonus: 0.08 }, icon: { shape: 'bow', color: 0xfff0a0 } });
reg({ key: 'plasmStaff', name: 'Plasm Staff', desc: 'Summons a loyal plasmling.', kind: 'weapon', rarity: 1, maxStack: 1, value: 90, weapon: { type: 'summonStaff', dmg: 9, speed: 1, knockback: 1, mana: 20, minion: 'minionPlasm' }, icon: { shape: 'staff', color: 0x7fd0e8 } });
reg({ key: 'gearStaff', name: 'Gearwing Staff', desc: 'Summons a whirring gearwing.', kind: 'weapon', rarity: 3, maxStack: 1, value: 240, weapon: { type: 'summonStaff', dmg: 24, speed: 1, knockback: 2, mana: 28, minion: 'minionGear' }, icon: { shape: 'staff', color: 0xb8c4cc } });
reg({ key: 'throwingStone', name: 'Throwing Stone', kind: 'weapon', rarity: 0, maxStack: 99, value: 1, weapon: { type: 'thrown', dmg: 6, speed: 2, knockback: 2, projectile: { look: 'shard', speed: 20, gravity: 0.5, color: 0x8a8f98 } }, icon: { shape: 'gem', color: 0x8a8f98 } });

// Ammo
reg({ key: 'arrow', name: 'Arrow', kind: 'material', rarity: 0, maxStack: 999, value: 1, icon: { shape: 'arrow', color: 0x9c7a4a } });
reg({ key: 'emberArrow', name: 'Ember Arrow', kind: 'material', rarity: 1, maxStack: 999, value: 3, icon: { shape: 'arrow', color: 0xff8a50 } });
reg({ key: 'frostArrow', name: 'Frost Arrow', kind: 'material', rarity: 1, maxStack: 999, value: 3, icon: { shape: 'arrow', color: 0x9ff0ff } });

// ---------------------------------------------------------------------------
// Accessories
// ---------------------------------------------------------------------------
const acc = (key: string, name: string, effect: NonNullable<ItemDef['accessory']>['effect'], magnitude: number, color: number, rarity: Rarity, desc: string) =>
  reg({ key, name, desc, kind: 'accessory', rarity, maxStack: 1, value: 60 + rarity * 40, accessory: { effect, magnitude }, icon: { shape: 'ring', color } });

acc('swiftBand', 'Swift Band', 'moveSpeed', 0.12, 0x58b04c, 1, '+12% movement speed.');
acc('leapCharm', 'Leap Charm', 'jumpBoost', 0.18, 0x5f8fd9, 1, '+18% jump height.');
acc('featherSigil', 'Feather Sigil', 'featherfall', 1, 0xfff0a0, 2, 'Negates fall damage.');
acc('ironSkinRing', 'Ironskin Ring', 'defense', 4, 0xb8b2a8, 1, '+4 defense.');
acc('eagleEye', 'Eagle Eye', 'critChance', 0.08, 0xe8c84a, 2, '+8% critical chance.');
acc('manaLoop', 'Mana Loop', 'manaMax', 30, 0x8a5fb0, 1, '+30 max mana.');
acc('enduranceKnot', 'Endurance Knot', 'staminaRegen', 0.35, 0xc97b4a, 1, '+35% stamina regen.');
acc('emberheart', 'Emberheart', 'warmth', 6, 0xff6a33, 2, 'Radiates warmth against the cold.');
acc('coolantCell', 'Coolant Cell', 'cooling', 6, 0x9ff0ff, 2, 'Chills the air around you.');
acc('gillPendant', 'Gill Pendant', 'gills', 1, 0x7fd0e8, 2, 'Breathe underwater.');
acc('lightCore', 'Light Core', 'lightAura', 8, 0xffe084, 2, 'Sheds light around you.');
acc('magnetCoil', 'Magnet Coil', 'magnet', 4, 0x5f8fa8, 1, 'Pulls dropped items toward you.');
acc('thornBand', 'Thorn Band', 'thorns', 8, 0x2f9e44, 2, 'Reflects contact damage.');

// ---------------------------------------------------------------------------
// Potions & consumables
// ---------------------------------------------------------------------------
const potion = (key: string, name: string, color: number, p: NonNullable<ItemDef['potion']>, rarity: Rarity = 0, desc?: string) =>
  reg({ key, name, desc, kind: 'consumable', rarity, maxStack: 30, value: 8 + rarity * 8, potion: p, icon: { shape: 'potion', color } });

potion('healingDraughtS', 'Lesser Healing Draught', 0xd94f4f, { heal: 35 });
potion('healingDraughtM', 'Healing Draught', 0xc43a3a, { heal: 70 }, 1);
potion('healingDraughtL', 'Greater Healing Draught', 0xa82e2e, { heal: 120 }, 2);
potion('manaDraught', 'Mana Draught', 0x5f8fd9, { mana: 60 });
potion('regenBrew', 'Regeneration Brew', 0xe07fa0, { effects: [{ key: 'regen', duration: 45 }] }, 1);
potion('ironhideBrew', 'Ironhide Brew', 0xb8b2a8, { effects: [{ key: 'ironhide', duration: 60 }] }, 1);
potion('swiftnessBrew', 'Swiftness Brew', 0x58b04c, { effects: [{ key: 'haste', duration: 60 }] }, 1);
potion('nightsightBrew', 'Nightsight Brew', 0x9fe8d0, { effects: [{ key: 'nightvision', duration: 90 }] }, 1);
potion('warmthBrew', 'Warmth Brew', 0xff8a50, { effects: [{ key: 'warmed', duration: 120 }] });
potion('coolingBrew', 'Cooling Brew', 0x9ff0ff, { effects: [{ key: 'cooled', duration: 120 }] });
potion('featherBrew', 'Featherfall Brew', 0xfff0a0, { effects: [{ key: 'featherfall', duration: 90 }] }, 1);
potion('gillsBrew', 'Gill Brew', 0x7fd0e8, { effects: [{ key: 'gills', duration: 120 }] }, 1);
potion('battleBrew', 'Battle Brew', 0xc44a4a, { effects: [{ key: 'battle', duration: 60 }] }, 2);
potion('antidote', 'Antidote', 0x6a8a4a, { effects: [{ key: 'cleanse', duration: 0.1 }] });

const food = (key: string, name: string, color: number, hunger: number, buffs?: { key: string; duration: number }[], rarity: Rarity = 0) =>
  reg({ key, name, kind: 'consumable', rarity, maxStack: 60, value: 2 + Math.round(hunger / 6), food: { hunger, buffs }, icon: { shape: 'food', color } });

food('berries', 'Berries', 0xb03a5f, 12);
food('amberkorn', 'Amberkorn', 0xe8c84a, 8);
food('rootstalk', 'Rootstalk', 0xc97b4a, 10);
food('glowfruit', 'Glowfruit', 0x9fe8d0, 14, [{ key: 'nightvision', duration: 30 }]);
food('frostcap', 'Frostcap', 0xbfe8f5, 12, [{ key: 'cooled', duration: 45 }]);
food('emberpod', 'Emberpod', 0xff8a50, 12, [{ key: 'warmed', duration: 45 }]);
food('cookedMeat', 'Seared Meat', 0x9c5a3a, 34, [{ key: 'wellfed', duration: 120 }]);
food('bread', 'Amber Bread', 0xd9a75c, 26, [{ key: 'wellfed', duration: 90 }]);
food('stew', 'Hearty Stew', 0xa8703f, 46, [{ key: 'wellfed', duration: 180 }, { key: 'regen', duration: 20 }], 1);
food('berryPie', 'Berry Pie', 0xc4547a, 38, [{ key: 'wellfed', duration: 150 }], 1);
food('glowJam', 'Glow Jam', 0x9fe8d0, 24, [{ key: 'nightvision', duration: 120 }], 1);
food('frostSorbet', 'Frost Sorbet', 0xbfe8f5, 24, [{ key: 'cooled', duration: 180 }], 1);
food('emberChili', 'Ember Chili', 0xff6a33, 30, [{ key: 'warmed', duration: 180 }, { key: 'battle', duration: 30 }], 2);
food('travelRations', 'Travel Rations', 0xc2a25c, 20, [{ key: 'haste', duration: 45 }], 1);

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------
for (const c of CROPS) {
  reg({ key: c.seed, name: `${c.name} Seeds`, kind: 'seed', rarity: 0, maxStack: 99, value: 3, block: `crop_${c.key}_0`, icon: { shape: 'seed', color: c.color } });
}

// ---------------------------------------------------------------------------
// Dyes (paint system: applied to plank/brick blocks)
// ---------------------------------------------------------------------------
for (const p of PAINTS) {
  reg({ key: `dye_${p.key}`, name: `${p.name} Dye`, kind: 'material', rarity: 0, maxStack: 99, value: 4, icon: { shape: 'potion', color: p.color } });
}

// ---------------------------------------------------------------------------
// Summons, coins, buckets
// ---------------------------------------------------------------------------
reg({ key: 'resonantSigil', name: 'Resonant Sigil', desc: 'Calls the Warden of the First Modulus. Use on the surface.', kind: 'summon', rarity: 2, maxStack: 5, value: 50, summons: 'bossWarden', icon: { shape: 'scroll', color: 0xd8b25e } });
reg({ key: 'umbralLens', name: 'Umbral Lens', desc: 'Focuses the failing sun. Calls the Chronophage by day.', kind: 'summon', rarity: 3, maxStack: 5, value: 90, summons: 'bossChronophage', icon: { shape: 'scroll', color: 0xe8c84a } });
reg({ key: 'nullBeacon', name: 'Null Beacon', desc: 'Only the Void answers. Use in the Void stratum.', kind: 'summon', rarity: 4, maxStack: 5, value: 150, summons: 'bossNull', icon: { shape: 'scroll', color: 0x9a7ae8 } });
reg({ key: 'coin', name: 'Cog', desc: 'Modular currency, still legal tender after 10,000 years.', kind: 'coin', rarity: 0, maxStack: 9999, value: 1, icon: { shape: 'coin', color: 0xe8c84a } });
reg({ key: 'emptyBucket', name: 'Bucket', kind: 'bucket', rarity: 0, maxStack: 1, value: 12, icon: { shape: 'bucket', color: 0xb8b2a8 } });
reg({ key: 'waterBucket', name: 'Water Bucket', kind: 'bucket', rarity: 0, maxStack: 1, value: 12, icon: { shape: 'bucket', color: 0x4a6fc4 } });
reg({ key: 'lavaBucket', name: 'Lava Bucket', kind: 'bucket', rarity: 1, maxStack: 1, value: 20, icon: { shape: 'bucket', color: 0xff6a33 } });

// ---------------------------------------------------------------------------
// Registry API
// ---------------------------------------------------------------------------
export const ITEM_DEFS: readonly ItemDef[] = defs;

export function itemByKey(key: string): ItemDef {
  const i = byKey.get(key);
  if (i === undefined) throw new Error(`unknown item key: ${key}`);
  return defs[i];
}

export function itemExists(key: string): boolean {
  return byKey.has(key);
}

export const ITEM_COUNT = defs.length;

export const RARITY_COLORS = [0xd8dce8, 0x58b04c, 0x5f8fd9, 0x8a5fb0, 0xe8a13a] as const;
export const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Mythic'] as const;
