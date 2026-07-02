/** The eight playable survivors of the Quotient. Traits shape the early game only. */

import type { CharacterDef } from './types';

const SKIN = 0xe8b98a;
const SKIN_BROWN = 0x9c6b45;

export const CHARACTERS: readonly CharacterDef[] = [
  {
    key: 'robin',
    name: 'Robin',
    trait: 'builder',
    traitName: 'Builder',
    traitDesc: 'Places blocks and crafts noticeably faster.',
    appearance: { skin: SKIN, hair: 0xe8d478, hairStyle: 'short', eyes: 0x6b4a2f, shirt: 0xe8e8ee, pants: 0x4a5568, height: 1, build: 1 },
    bonuses: { buildSpeed: 1.15, craftSpeed: 1.15 },
    startItems: [['workbench', 1], ['timber', 20]],
  },
  {
    key: 'leif',
    name: 'Leif',
    trait: 'hunter',
    traitName: 'Hunter',
    traitDesc: 'Deadlier bows, tracks prey, strikes true.',
    appearance: { skin: SKIN, hair: 0x6b4a2f, hairStyle: 'medium', eyes: 0x8f98a8, shirt: 0x2e3138, pants: 0x3d4454, height: 1, build: 1 },
    bonuses: { bowDamage: 1.15, critChance: 1.05, tracking: 1 },
    startItems: [['woodBow', 1], ['arrow', 60]],
  },
  {
    key: 'jovan',
    name: 'Jovan',
    trait: 'explorer',
    traitName: 'Explorer',
    traitDesc: 'Faster on foot, grips walls, sees farther.',
    appearance: { skin: SKIN, hair: 0x6b4a2f, hairStyle: 'medium', eyes: 0x6b4a2f, shirt: 0xe8e8ee, pants: 0x4a5568, height: 1.08, build: 1 },
    bonuses: { moveSpeed: 1.12, climb: 1, visionRadius: 1.25 },
    startItems: [['rope', 30], ['torch', 10]],
  },
  {
    key: 'leonidas',
    name: 'Leonidas',
    trait: 'warrior',
    traitName: 'Warrior',
    traitDesc: 'Hits harder, endures more.',
    appearance: { skin: SKIN, hair: 0x5d4027, hairStyle: 'styled', eyes: 0x6b4a2f, shirt: 0xb03a3a, pants: 0x3d4454, height: 0.92, build: 1.25 },
    bonuses: { meleeDamage: 1.15, maxHp: 1.2, defense: 2 },
    startItems: [['healingDraughtS', 3]],
  },
  {
    key: 'erim',
    name: 'Erim',
    trait: 'engineer',
    traitName: 'Engineer',
    traitDesc: 'Machines hum faster; electronics come cheaper.',
    appearance: { skin: SKIN, hair: 0x23252b, hairStyle: 'medium', eyes: 0x6b4a2f, shirt: 0x4a5568, pants: 0x2e3138, glasses: true, goatee: true, height: 1, build: 1 },
    bonuses: { machineSpeed: 1.25, electronicsCost: 0.75 },
    startItems: [['copperBar', 8], ['torch', 10]],
  },
  {
    key: 'till',
    name: 'Till',
    trait: 'gatherer',
    traitName: 'Gatherer',
    traitDesc: 'Mines and chops faster, with richer yields.',
    appearance: { skin: SKIN, hair: 0xe8d478, hairStyle: 'short', eyes: 0x5f8fd9, shirt: 0x6b83a8, pants: 0x4a5568, height: 1, build: 1 },
    bonuses: { mineSpeed: 1.2, resourceYield: 1.1 },
    startItems: [['woodHammer', 1], ['torch', 15]],
  },
  {
    key: 'lenni',
    name: 'Lenni',
    trait: 'scholar',
    traitName: 'Scholar',
    traitDesc: 'Learns recipes sooner, wastes less, channels more.',
    appearance: { skin: SKIN, hair: 0x6b4a2f, hairStyle: 'middlePart', eyes: 0x6b4a2f, shirt: 0x2f5e3d, pants: 0x2e3138, glasses: true, height: 1, build: 1 },
    bonuses: { research: 1.2, manaCost: 0.9, craftWaste: 0.9 },
    startItems: [['manaDraught', 3], ['glass', 5]],
  },
  {
    key: 'tusya',
    name: 'Tusya',
    trait: 'merchant',
    traitName: 'Merchant',
    traitDesc: 'Better prices, luckier loot, deeper pockets.',
    appearance: { skin: SKIN_BROWN, hair: 0x1a1a1e, hairStyle: 'short', eyes: 0x4e3b2a, shirt: 0xd9a75c, pants: 0x3d4454, height: 1, build: 1 },
    bonuses: { shopPrices: 0.85, lootLuck: 1.1 },
    startItems: [['coin', 150]],
  },
];

export function characterByKey(key: string): CharacterDef {
  const c = CHARACTERS.find((c) => c.key === key);
  if (!c) throw new Error(`unknown character: ${key}`);
  return c;
}
