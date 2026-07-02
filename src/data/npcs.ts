/** NPC definitions: dialogue, shops, quests, biome preferences, arrival gating. */

import type { NPCDef } from './types';

const npcs: NPCDef[] = [
  {
    key: 'ordo',
    name: 'Ordo',
    title: 'the Merchant',
    appearance: { skin: 0xd9a06b, hair: 0x8f8a80, hairStyle: 'short', eyes: 0x4e3b2a, shirt: 0xd9a75c, pants: 0x4a5568, height: 0.95, build: 1.1 },
    dialogue: [
      'Two hundred years between strata and your coins are still good. Remarkable currency.',
      'Everything is for sale. Some of it is even mine to sell.',
      'The Moduli built doors between worlds and you people built… torches. Start there.',
      'Buy a rope. Nobody ever regretted owning rope.',
    ],
    eventDialogue: {
      crimsonStatic: ['Shutters down, prices up. Static nights are bad for inventory.'],
      umbralVeil: ['The sun goes out and suddenly everyone needs arrows. Funny thing, commerce.'],
    },
    shop: [
      ['torch', 0], ['rope', 0], ['healingDraughtS', 0], ['arrow', 0],
      ['emptyBucket', 0], ['amberkornSeeds', 0], ['berrySeeds', 0], ['travelRations', 0],
    ],
    quests: ['ordo_fiber'],
    biomeLikes: ['meadow', 'forest'],
    biomeDislikes: ['volcanic', 'snowfields'],
  },
  {
    key: 'vessa',
    name: 'Vessa',
    title: 'the Herbalist',
    appearance: { skin: 0xe8b98a, hair: 0xb03a5f, hairStyle: 'medium', eyes: 0x2f6b4f, shirt: 0x2f5e3d, pants: 0x3d4454, height: 1, build: 0.9 },
    dialogue: [
      'The flowers grow wrong where the drift is strong. I map the failure in petals.',
      'Glowshrooms for sight, berries for blood. The world provides, if you ask nicely.',
      'Do not eat the violet ones. Or do — I keep antidotes in stock.',
    ],
    eventDialogue: {
      meteorShower: ['Skyfall ash makes the best fertilizer. Bring a basket.'],
    },
    shop: [
      ['antidote', 0], ['regenBrew', 0], ['warmthBrew', 0], ['coolingBrew', 0],
      ['glowfruitSeeds', 0], ['rootstalkSeeds', 0], ['mushroom', 0],
    ],
    quests: ['vessa_berries', 'vessa_glow'],
    biomeLikes: ['forest', 'jungle'],
    biomeDislikes: ['desert'],
  },
  {
    key: 'brann',
    name: 'Brann',
    title: 'the Tinker',
    appearance: { skin: 0xc98f5f, hair: 0x6b4a2f, hairStyle: 'short', eyes: 0x4e3b2a, shirt: 0x4a5568, pants: 0x2e3138, goatee: true, height: 0.97, build: 1.15 },
    dialogue: [
      'I salvaged the Machine stratum for six years. I left when the machines started salvaging back.',
      'A generator, an extractor, and patience — that is a mining company.',
      'Wire it, light it, and never stand under the thing you are testing.',
    ],
    eventDialogue: {
      incursion: ['Rifts again? Keep your circuits dry and your door shut.'],
    },
    shop: [
      ['circuit', 0], ['gearScrap', 0], ['arcLamp', 0], ['sprinkler', 0], ['magnetCoil', 0],
    ],
    quests: ['brann_circuit'],
    biomeLikes: ['mountains', 'desert'],
    biomeDislikes: ['jungle'],
    arrivesWhen: 'boss.warden',
  },
  {
    key: 'kael',
    name: 'Kael',
    title: 'the Nomad',
    appearance: { skin: 0x9c6b45, hair: 0x1a1a1e, hairStyle: 'medium', eyes: 0x4e3b2a, shirt: 0xa8703f, pants: 0x3d4454, height: 1.04, build: 0.95 },
    dialogue: [
      'Every obelisk is a sentence. I have been walking the same paragraph for a decade.',
      'The Remainder was not an explosion. It was a rounding error. Sleep well.',
      'The Wardens are not evil. They are thorough. There is a difference, barely.',
    ],
    eventDialogue: {
      umbralVeil: ['The tablets call this "the sun forgetting". It remembers eventually. Usually.'],
    },
    shop: [['travelRations', 0], ['torch', 0], ['featherBrew', 0]],
    quests: ['kael_depth', 'kael_warden'],
    biomeLikes: ['desert', 'mountains'],
    biomeDislikes: ['forest'],
  },
];

const byKey = new Map(npcs.map((n) => [n.key, n]));
export const NPC_DEFS: readonly NPCDef[] = npcs;
export function npcByKey(key: string): NPCDef {
  const n = byKey.get(key);
  if (!n) throw new Error(`unknown npc: ${key}`);
  return n;
}
