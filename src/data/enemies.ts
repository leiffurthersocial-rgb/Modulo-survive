/**
 * Enemy registry. ~45 hand-authored creatures across biomes, strata, dimensions
 * and events; every non-boss also generates an "Elder" variant (tougher, richer
 * drops), yielding 100+ functional enemy types. AI behavior comes from the
 * archetype (game/ai.ts); looks come from the sprite plan (render/sprites.ts).
 */

import type { EnemyDef, LootEntry } from './types';

const defs: EnemyDef[] = [];
const byKey = new Map<string, number>();

function reg(e: EnemyDef): void {
  if (byKey.has(e.key)) throw new Error(`duplicate enemy key: ${e.key}`);
  byKey.set(e.key, defs.length);
  defs.push(e);
}

const L = (item: string, min: number, max: number, chance: number): LootEntry => ({ item, min, max, chance });

// ---------------------------------------------------------------------------
// Overworld — surface, day
// ---------------------------------------------------------------------------
reg({ key: 'plasmling', name: 'Plasmling', archetype: 'hopper', plan: 'blob', hp: 26, dmg: 8, defense: 0, speed: 4, scale: 1, color: 0x7fd0e8, drops: [L('plasm', 1, 2, 0.9)], coins: [1, 3], spawn: { strata: ['surface'], day: true, weight: 30 } });
reg({ key: 'boarling', name: 'Boarling', archetype: 'charger', plan: 'quad', hp: 40, dmg: 12, defense: 2, speed: 6.5, scale: 1.1, color: 0x8a6238, color2: 0xd8d4c8, drops: [L('rawMeat', 1, 2, 0.8), L('hide', 1, 2, 0.5)], coins: [2, 4], spawn: { biomes: ['meadow', 'forest'], strata: ['surface'], day: true, weight: 16 } });
reg({ key: 'dustwing', name: 'Dustwing', archetype: 'flyer', plan: 'flyer', hp: 22, dmg: 9, defense: 0, speed: 5.5, scale: 0.9, color: 0xc2a25c, drops: [L('featherGale', 1, 1, 0.15)], coins: [1, 3], spawn: { biomes: ['desert'], weight: 18 } });
reg({ key: 'sandsnapper', name: 'Sandsnapper', archetype: 'burrower', plan: 'quad', hp: 55, dmg: 15, defense: 4, speed: 5, scale: 1.2, color: 0xd9c27e, color2: 0x8a6a45, drops: [L('fang', 1, 2, 0.6), L('hide', 1, 1, 0.4)], coins: [3, 6], spawn: { biomes: ['desert'], strata: ['surface'], weight: 12 } });
reg({ key: 'thornhopper', name: 'Thornhopper', archetype: 'hopper', plan: 'blob', hp: 34, dmg: 11, defense: 1, speed: 5, scale: 1.05, color: 0x2f9e44, color2: 0xd94f4f, drops: [L('plasm', 1, 2, 0.8), L('plantFiber', 1, 3, 0.6)], coins: [1, 3], inflicts: { key: 'poison', duration: 4, chance: 0.35 }, spawn: { biomes: ['jungle'], weight: 22 } });
reg({ key: 'frosthare', name: 'Frost Hare', archetype: 'hopper', plan: 'quad', hp: 24, dmg: 7, defense: 0, speed: 7, scale: 0.85, color: 0xe8f0f5, drops: [L('rawMeat', 1, 1, 0.7), L('hide', 1, 1, 0.4)], coins: [1, 2], spawn: { biomes: ['snowfields', 'mountains'], day: true, weight: 18 } });
reg({ key: 'cinderbeetle', name: 'Cinder Beetle', archetype: 'walker', plan: 'quad', hp: 48, dmg: 14, defense: 6, speed: 3, scale: 1, color: 0x59372e, color2: 0xff6a33, drops: [L('essenceEmber', 1, 1, 0.25)], coins: [3, 6], inflicts: { key: 'burning', duration: 3, chance: 0.4 }, spawn: { biomes: ['volcanic'], weight: 20 } });

// ---------------------------------------------------------------------------
// Overworld — surface, night
// ---------------------------------------------------------------------------
reg({ key: 'hollowShambler', name: 'Hollow Shambler', archetype: 'walker', plan: 'humanoid', hp: 55, dmg: 14, defense: 2, speed: 3.2, scale: 1, color: 0x5a6b5d, color2: 0x2e3138, drops: [L('boneShard', 1, 2, 0.5)], coins: [2, 5], spawn: { strata: ['surface'], night: true, weight: 30 } });
reg({ key: 'gloomFloater', name: 'Gloom Floater', archetype: 'floater', plan: 'wisp', hp: 40, dmg: 12, defense: 0, speed: 3.4, scale: 1, color: 0x8a5fb0, knockbackResist: 0.3, drops: [L('essenceVoid', 1, 1, 0.08)], coins: [3, 6], spawn: { strata: ['surface'], night: true, weight: 16 } });
reg({ key: 'nightStalker', name: 'Night Stalker', archetype: 'charger', plan: 'quad', hp: 65, dmg: 18, defense: 3, speed: 8, scale: 1.15, color: 0x2e3138, color2: 0xd94f4f, drops: [L('fang', 1, 2, 0.7), L('hide', 1, 2, 0.5)], coins: [4, 8], spawn: { strata: ['surface'], night: true, weight: 14 } });
reg({ key: 'webspinner', name: 'Webspinner', archetype: 'walker', plan: 'quad', hp: 50, dmg: 13, defense: 2, speed: 4.5, scale: 1.1, color: 0x4a3a52, color2: 0xd8d8e0, drops: [L('silkThread', 1, 3, 0.9)], coins: [3, 6], inflicts: { key: 'poison', duration: 5, chance: 0.3 }, spawn: { biomes: ['jungle', 'forest'], night: true, weight: 14 } });
reg({ key: 'boneArcher', name: 'Bone Archer', archetype: 'caster', plan: 'humanoid', hp: 45, dmg: 13, defense: 1, speed: 2.8, scale: 1, color: 0xd8d4c8, color2: 0x8a8f98, castRate: 2.6, projectile: { look: 'arrow', speed: 18, gravity: 0.3, color: 0xd8d4c8 }, drops: [L('boneShard', 1, 3, 0.8), L('arrow', 3, 8, 0.6)], coins: [3, 7], spawn: { strata: ['surface'], night: true, weight: 12 } });

// ---------------------------------------------------------------------------
// Underground & cavern
// ---------------------------------------------------------------------------
reg({ key: 'cavePlasm', name: 'Cave Plasm', archetype: 'hopper', plan: 'blob', hp: 42, dmg: 12, defense: 1, speed: 4.2, scale: 1.1, color: 0x5f8fd9, drops: [L('plasm', 1, 3, 0.9)], coins: [2, 4], spawn: { strata: ['underground', 'cavern'], weight: 26 } });
reg({ key: 'screecher', name: 'Screecher', archetype: 'diver', plan: 'flyer', hp: 30, dmg: 11, defense: 0, speed: 7, scale: 0.85, color: 0x4e3b2a, drops: [L('hide', 1, 1, 0.3)], coins: [2, 4], spawn: { strata: ['underground', 'cavern'], weight: 24 } });
reg({ key: 'boneWalker', name: 'Bone Walker', archetype: 'walker', plan: 'humanoid', hp: 70, dmg: 17, defense: 4, speed: 3.4, scale: 1, color: 0xd8d4c8, color2: 0x5a5e6b, drops: [L('boneShard', 2, 4, 0.9)], coins: [4, 8], spawn: { strata: ['underground', 'cavern'], weight: 18 } });
reg({ key: 'deepCaster', name: 'Deep Caster', archetype: 'caster', plan: 'humanoid', hp: 60, dmg: 16, defense: 2, speed: 2.6, scale: 1, color: 0x5d4a8a, color2: 0x9fe8d0, castRate: 2.8, projectile: { look: 'orb', speed: 14, gravity: 0, homing: 1.2, color: 0x9fe8d0 }, drops: [L('crystalOre', 1, 2, 0.4), L('manaDraught', 1, 1, 0.15)], coins: [5, 10], spawn: { strata: ['cavern'], weight: 12 } });
reg({ key: 'crystalSkitter', name: 'Crystal Skitter', archetype: 'walker', plan: 'quad', hp: 58, dmg: 15, defense: 6, speed: 5, scale: 0.95, color: 0x7a6f9e, color2: 0x8be0e8, drops: [L('crystalOre', 1, 3, 0.7), L('prismDust', 1, 2, 0.3)], coins: [5, 9], spawn: { biomes: ['crystalCavern'], weight: 20 } });
reg({ key: 'gloomEel', name: 'Gloom Eel', archetype: 'swimmer', plan: 'wisp', hp: 45, dmg: 14, defense: 1, speed: 6, scale: 1.1, color: 0x2f4858, color2: 0x7fd0e8, drops: [L('plasm', 1, 2, 0.6)], coins: [3, 6], spawn: { strata: ['underground', 'cavern'], weight: 10 } });
reg({ key: 'magmaSpitter', name: 'Magma Spitter', archetype: 'spitter', plan: 'blob', hp: 75, dmg: 18, defense: 5, speed: 2.5, scale: 1.15, color: 0xff6a33, color2: 0x59372e, castRate: 2.4, projectile: { look: 'flame', speed: 13, gravity: 0.4, color: 0xff6a33, status: { key: 'burning', duration: 3, chance: 0.6 } }, drops: [L('essenceEmber', 1, 1, 0.3)], coins: [6, 11], spawn: { strata: ['deep'], weight: 20 } });
reg({ key: 'ashWisp', name: 'Ash Wisp', archetype: 'floater', plan: 'wisp', hp: 50, dmg: 15, defense: 0, speed: 3.8, scale: 0.9, color: 0x6d6a70, color2: 0xff8a50, knockbackResist: 0.4, drops: [L('essenceEmber', 1, 1, 0.2)], coins: [4, 8], spawn: { strata: ['deep'], weight: 14 } });
reg({ key: 'fungalDrifter', name: 'Fungal Drifter', archetype: 'floater', plan: 'wisp', hp: 44, dmg: 12, defense: 0, speed: 3, scale: 1, color: 0xb08ad0, color2: 0x9fe8d0, drops: [L('glowshroom', 1, 2, 0.6), L('mushroom', 1, 2, 0.5)], coins: [3, 6], inflicts: { key: 'poison', duration: 4, chance: 0.3 }, spawn: { biomes: ['fungalHollow'], weight: 20 } });
reg({ key: 'labSentinel', name: 'Lab Sentinel', archetype: 'turret', plan: 'turret', hp: 90, dmg: 16, defense: 8, speed: 0, scale: 1, color: 0xa8c4c8, color2: 0xd94f4f, castRate: 2.0, projectile: { look: 'bolt', speed: 20, gravity: 0, color: 0xd94f4f }, drops: [L('circuit', 1, 2, 0.6), L('gearScrap', 1, 3, 0.8)], coins: [8, 14], spawn: { strata: ['underground', 'cavern'], weight: 4 } });

// ---------------------------------------------------------------------------
// Event enemies
// ---------------------------------------------------------------------------
reg({ key: 'staticWraith', name: 'Static Wraith', archetype: 'floater', plan: 'wisp', hp: 85, dmg: 20, defense: 3, speed: 4.5, scale: 1.1, color: 0xd94f4f, color2: 0xffffff, knockbackResist: 0.5, drops: [L('essenceTime', 1, 1, 0.06), L('silverBar', 1, 2, 0.3)], coins: [8, 15], spawn: { event: 'crimsonStatic', weight: 30 } });
reg({ key: 'crimsonHusk', name: 'Crimson Husk', archetype: 'walker', plan: 'humanoid', hp: 95, dmg: 22, defense: 5, speed: 4.2, scale: 1.05, color: 0x8a2e2e, color2: 0xd94f4f, drops: [L('boneShard', 2, 4, 0.8), L('essenceEmber', 1, 1, 0.2)], coins: [8, 14], spawn: { event: 'crimsonStatic', weight: 26 } });
reg({ key: 'umbralHunter', name: 'Umbral Hunter', archetype: 'charger', plan: 'quad', hp: 110, dmg: 26, defense: 6, speed: 9, scale: 1.2, color: 0x241f33, color2: 0xe8c84a, drops: [L('essenceTime', 1, 1, 0.12)], coins: [10, 18], spawn: { event: 'umbralVeil', weight: 26 } });
reg({ key: 'eclipseCaster', name: 'Eclipse Caster', archetype: 'caster', plan: 'humanoid', hp: 90, dmg: 22, defense: 4, speed: 3, scale: 1, color: 0x3a3152, color2: 0xe8c84a, castRate: 2.2, projectile: { look: 'shard', speed: 17, gravity: 0, homing: 1.6, color: 0xe8c84a }, drops: [L('essenceTime', 1, 1, 0.12), L('manaDraught', 1, 2, 0.3)], coins: [10, 18], spawn: { event: 'umbralVeil', weight: 18 } });
reg({ key: 'riftSpawn', name: 'Rift Spawn', archetype: 'floater', plan: 'orb', hp: 70, dmg: 18, defense: 2, speed: 5, scale: 0.9, color: 0x9a7ae8, color2: 0x241f33, knockbackResist: 0.3, drops: [L('essenceVoid', 1, 1, 0.3)], coins: [6, 12], spawn: { event: 'incursion', weight: 30 } });

// ---------------------------------------------------------------------------
// Dimension enemies (three per stratum)
// ---------------------------------------------------------------------------
reg({ key: 'dustRevenant', name: 'Dust Revenant', archetype: 'walker', plan: 'humanoid', hp: 130, dmg: 26, defense: 8, speed: 3.6, scale: 1.05, color: 0x8a6a45, color2: 0xd8b25e, drops: [L('relictiumOre', 1, 2, 0.35), L('boneShard', 2, 4, 0.7)], coins: [10, 18], spawn: { dims: ['ancient'], weight: 26 } });
reg({ key: 'vaultSentinel', name: 'Vault Sentinel', archetype: 'turret', plan: 'turret', hp: 160, dmg: 24, defense: 12, speed: 0, scale: 1.1, color: 0xa8834f, color2: 0xe8c84a, castRate: 1.8, projectile: { look: 'bolt', speed: 22, gravity: 0, color: 0xe8c84a }, drops: [L('relictiumOre', 1, 3, 0.5), L('goldBar', 1, 2, 0.3)], coins: [14, 24], spawn: { dims: ['ancient'], weight: 8 } });
reg({ key: 'sandMaw', name: 'Sand Maw', archetype: 'burrower', plan: 'quad', hp: 150, dmg: 30, defense: 8, speed: 6, scale: 1.3, color: 0xd9c27e, color2: 0x8a2e2e, drops: [L('fang', 2, 4, 0.8), L('relictiumOre', 1, 2, 0.3)], coins: [12, 20], spawn: { dims: ['ancient'], weight: 14 } });

reg({ key: 'prismWisp', name: 'Prism Wisp', archetype: 'floater', plan: 'wisp', hp: 110, dmg: 24, defense: 4, speed: 4.4, scale: 1, color: 0xe0b8ff, color2: 0x8be0e8, knockbackResist: 0.4, drops: [L('prismDust', 1, 3, 0.7), L('prismiteOre', 1, 2, 0.3)], coins: [10, 18], spawn: { dims: ['crystal'], weight: 24 } });
reg({ key: 'shardHopper', name: 'Shard Hopper', archetype: 'hopper', plan: 'blob', hp: 125, dmg: 26, defense: 8, speed: 5.5, scale: 1.15, color: 0x8be0e8, color2: 0xe0b8ff, drops: [L('prismiteOre', 1, 2, 0.4), L('plasm', 2, 3, 0.6)], coins: [10, 18], inflicts: { key: 'bleeding', duration: 4, chance: 0.3 }, spawn: { dims: ['crystal'], weight: 22 } });
reg({ key: 'refractionCaster', name: 'Refraction Caster', archetype: 'caster', plan: 'humanoid', hp: 120, dmg: 28, defense: 6, speed: 3, scale: 1, color: 0x7a6f9e, color2: 0xe0b8ff, castRate: 2.0, projectile: { look: 'shard', speed: 20, gravity: 0, pierce: 2, color: 0xe0b8ff }, drops: [L('prismiteOre', 1, 3, 0.4), L('manaDraught', 1, 2, 0.3)], coins: [12, 20], spawn: { dims: ['crystal'], weight: 14 } });

reg({ key: 'iceStalker', name: 'Ice Stalker', archetype: 'charger', plan: 'quad', hp: 140, dmg: 30, defense: 8, speed: 9, scale: 1.2, color: 0x9ff0ff, color2: 0x2e3138, drops: [L('cryostalOre', 1, 2, 0.35), L('fang', 2, 3, 0.7)], coins: [12, 20], inflicts: { key: 'freezing', duration: 3, chance: 0.5 }, spawn: { dims: ['frozen'], weight: 22 } });
reg({ key: 'frostWisp', name: 'Frost Wisp', archetype: 'floater', plan: 'wisp', hp: 115, dmg: 26, defense: 4, speed: 4, scale: 1, color: 0xbfe8f5, color2: 0x9ff0ff, knockbackResist: 0.4, drops: [L('essenceFrost', 1, 2, 0.6)], coins: [10, 18], inflicts: { key: 'freezing', duration: 3, chance: 0.5 }, spawn: { dims: ['frozen'], weight: 22 } });
reg({ key: 'glacierGolem', name: 'Glacier Golem', archetype: 'walker', plan: 'humanoid', hp: 220, dmg: 34, defense: 16, speed: 2.4, scale: 1.5, color: 0x8fa8bd, color2: 0x9ff0ff, knockbackResist: 0.7, drops: [L('cryostalOre', 2, 4, 0.6), L('essenceFrost', 1, 2, 0.4)], coins: [16, 28], spawn: { dims: ['frozen'], weight: 10 } });

reg({ key: 'cinderHound', name: 'Cinder Hound', archetype: 'charger', plan: 'quad', hp: 150, dmg: 32, defense: 8, speed: 9.5, scale: 1.2, color: 0x59372e, color2: 0xff6a33, drops: [L('magmiteOre', 1, 2, 0.35), L('essenceEmber', 1, 2, 0.5)], coins: [14, 24], inflicts: { key: 'burning', duration: 4, chance: 0.5 }, spawn: { dims: ['molten'], weight: 22 } });
reg({ key: 'magmaFloater', name: 'Magma Floater', archetype: 'floater', plan: 'orb', hp: 130, dmg: 28, defense: 6, speed: 3.6, scale: 1.05, color: 0xff6a33, color2: 0x3a3540, knockbackResist: 0.5, drops: [L('magmiteOre', 1, 2, 0.4)], coins: [12, 22], inflicts: { key: 'burning', duration: 4, chance: 0.6 }, spawn: { dims: ['molten'], weight: 20 } });
reg({ key: 'ashSpitter', name: 'Ash Spitter', archetype: 'spitter', plan: 'blob', hp: 140, dmg: 30, defense: 10, speed: 2.6, scale: 1.2, color: 0x6d6a70, color2: 0xff6a33, castRate: 2.2, projectile: { look: 'flame', speed: 15, gravity: 0.3, color: 0xff8a50, status: { key: 'burning', duration: 4, chance: 0.7 } }, drops: [L('magmiteOre', 1, 3, 0.4)], coins: [14, 24], spawn: { dims: ['molten'], weight: 14 } });

reg({ key: 'scrapCrawler', name: 'Scrap Crawler', archetype: 'walker', plan: 'quad', hp: 160, dmg: 30, defense: 14, speed: 4, scale: 1.15, color: 0x6e4a33, color2: 0xb8c4cc, drops: [L('gearScrap', 2, 4, 0.9), L('ferroxOre', 1, 2, 0.3)], coins: [14, 24], spawn: { dims: ['machine'], weight: 24 } });
reg({ key: 'gearDrone', name: 'Gear Drone', archetype: 'flyer', plan: 'flyer', hp: 120, dmg: 26, defense: 8, speed: 6.5, scale: 0.95, color: 0xb8c4cc, color2: 0xd94f4f, drops: [L('gearScrap', 1, 3, 0.8), L('circuit', 1, 1, 0.25)], coins: [12, 20], spawn: { dims: ['machine'], weight: 22 } });
reg({ key: 'foundryTurret', name: 'Foundry Turret', archetype: 'turret', plan: 'turret', hp: 200, dmg: 30, defense: 18, speed: 0, scale: 1.15, color: 0x54392a, color2: 0xff6a33, castRate: 1.6, projectile: { look: 'gear', speed: 24, gravity: 0, pierce: 1, color: 0xb8c4cc }, drops: [L('ferroxOre', 1, 3, 0.5), L('circuit', 1, 2, 0.4)], coins: [18, 30], spawn: { dims: ['machine'], weight: 8 } });

reg({ key: 'galeRay', name: 'Gale Ray', archetype: 'flyer', plan: 'flyer', hp: 120, dmg: 26, defense: 6, speed: 7.5, scale: 1.2, color: 0xfff0a0, color2: 0xdfe8f5, drops: [L('featherGale', 1, 3, 0.8), L('auraliteOre', 1, 2, 0.3)], coins: [12, 20], spawn: { dims: ['sky'], weight: 24 } });
reg({ key: 'nimbusCaster', name: 'Nimbus Caster', archetype: 'caster', plan: 'humanoid', hp: 130, dmg: 28, defense: 6, speed: 3.4, scale: 1, color: 0xdfe8f5, color2: 0xfff0a0, castRate: 2.0, projectile: { look: 'bolt', speed: 19, gravity: 0, homing: 1.4, color: 0xfff0a0 }, drops: [L('auraliteOre', 1, 2, 0.4)], coins: [14, 22], spawn: { dims: ['sky'], weight: 16 } });
reg({ key: 'zephyrDiver', name: 'Zephyr Diver', archetype: 'diver', plan: 'flyer', hp: 110, dmg: 30, defense: 4, speed: 10, scale: 1, color: 0xdfe8f5, color2: 0x5f8fd9, drops: [L('featherGale', 1, 2, 0.7)], coins: [12, 20], spawn: { dims: ['sky'], weight: 18 } });

reg({ key: 'nullHusk', name: 'Null Husk', archetype: 'walker', plan: 'humanoid', hp: 200, dmg: 36, defense: 14, speed: 4, scale: 1.1, color: 0x241f33, color2: 0x9a7ae8, drops: [L('essenceVoid', 1, 2, 0.6), L('voidglassOre', 1, 2, 0.3)], coins: [18, 30], spawn: { dims: ['void'], weight: 24 } });
reg({ key: 'voidWatcher', name: 'Void Watcher', archetype: 'caster', plan: 'orb', hp: 170, dmg: 34, defense: 10, speed: 3.4, scale: 1.1, color: 0x3a3152, color2: 0x9a7ae8, castRate: 1.8, projectile: { look: 'orb', speed: 18, gravity: 0, homing: 2, color: 0x9a7ae8 }, drops: [L('essenceVoid', 1, 2, 0.6), L('voidglassOre', 1, 2, 0.4)], coins: [18, 32], spawn: { dims: ['void'], weight: 16 } });
reg({ key: 'echoFloater', name: 'Echo Floater', archetype: 'floater', plan: 'wisp', hp: 180, dmg: 32, defense: 8, speed: 4.6, scale: 1.05, color: 0x1a1626, color2: 0x5d4a8a, knockbackResist: 0.6, drops: [L('essenceVoid', 1, 2, 0.5)], coins: [16, 28], spawn: { dims: ['void'], weight: 20 } });

// ---------------------------------------------------------------------------
// Player minions (summon staves; never spawned by the world)
// ---------------------------------------------------------------------------
reg({ key: 'minionPlasm', name: 'Plasmling Ally', archetype: 'minion', plan: 'blob', hp: 1, dmg: 9, defense: 0, speed: 8, scale: 0.8, color: 0x7fd0e8, color2: 0xffffff, drops: [], coins: [0, 0] });
reg({ key: 'minionGear', name: 'Gearwing', archetype: 'minion', plan: 'flyer', hp: 1, dmg: 24, defense: 0, speed: 10, scale: 0.85, color: 0xb8c4cc, color2: 0xfff0a0, drops: [], coins: [0, 0] });

// ---------------------------------------------------------------------------
// Bosses
// ---------------------------------------------------------------------------
reg({ key: 'bossWarden', name: 'Warden of the First Modulus', archetype: 'walker', plan: 'humanoid', boss: true, hp: 2200, dmg: 28, defense: 14, speed: 3.6, scale: 3, color: 0x8a8f98, color2: 0xd8b25e, knockbackResist: 1, castRate: 2.4, projectile: { look: 'shard', speed: 14, gravity: 0.5, color: 0xd8b25e }, drops: [L('wardenCore', 1, 2, 1), L('wardenHammer', 1, 1, 0.25), L('healingDraughtM', 3, 5, 1)], coins: [150, 250] });
reg({ key: 'wardenShardling', name: 'Shardling', archetype: 'hopper', plan: 'blob', hp: 60, dmg: 14, defense: 4, speed: 5, scale: 0.9, color: 0x8a8f98, color2: 0xd8b25e, drops: [L('stone', 2, 5, 0.8)], coins: [2, 4] });
reg({ key: 'bossChronophage', name: 'Chronophage', archetype: 'flyer', plan: 'flyer', boss: true, hp: 3200, dmg: 34, defense: 18, speed: 8, scale: 2.6, color: 0x3a3152, color2: 0xe8c84a, knockbackResist: 1, castRate: 1.6, projectile: { look: 'shard', speed: 16, gravity: 0, homing: 0.8, color: 0xe8c84a }, drops: [L('chronoHeart', 1, 1, 1), L('essenceTime', 3, 6, 1), L('chronoBlade', 1, 1, 0.25)], coins: [220, 350] });
reg({ key: 'bossNull', name: 'The Null Sovereign', archetype: 'floater', plan: 'orb', boss: true, hp: 5200, dmg: 44, defense: 26, speed: 5, scale: 3.2, color: 0x241f33, color2: 0x9a7ae8, knockbackResist: 1, castRate: 1.2, projectile: { look: 'orb', speed: 15, gravity: 0, homing: 1.2, color: 0x9a7ae8 }, drops: [L('nullCrown', 1, 2, 1), L('nullScepter', 1, 1, 0.33), L('voidglassBar', 4, 8, 1)], coins: [400, 650] });
reg({ key: 'bossRefractor', name: 'The Refractor', archetype: 'floater', plan: 'orb', boss: true, hp: 2800, dmg: 32, defense: 16, speed: 5.5, scale: 2.4, color: 0xe0b8ff, color2: 0x8be0e8, knockbackResist: 1, castRate: 1.5, projectile: { look: 'shard', speed: 18, gravity: 0, pierce: 2, color: 0xe0b8ff }, drops: [L('prismiteBar', 4, 8, 1), L('prismDust', 6, 12, 1)], coins: [200, 320] });
reg({ key: 'bossBorea', name: 'Borea, the Stilled Heart', archetype: 'walker', plan: 'humanoid', boss: true, hp: 3000, dmg: 36, defense: 20, speed: 3, scale: 3, color: 0x8fa8bd, color2: 0x9ff0ff, knockbackResist: 1, castRate: 2.0, projectile: { look: 'shard', speed: 15, gravity: 0.2, color: 0x9ff0ff, status: { key: 'freezing', duration: 3, chance: 0.7 } }, drops: [L('cryostalBar', 4, 8, 1), L('essenceFrost', 4, 8, 1)], coins: [200, 320] });
reg({ key: 'bossPyraxis', name: 'Pyraxis the Undermelt', archetype: 'floater', plan: 'orb', boss: true, hp: 3600, dmg: 40, defense: 22, speed: 4.5, scale: 2.8, color: 0xff6a33, color2: 0x3a3540, knockbackResist: 1, castRate: 1.4, projectile: { look: 'flame', speed: 14, gravity: 0.2, color: 0xff6a33, status: { key: 'burning', duration: 4, chance: 0.8 } }, drops: [L('magmiteBar', 4, 8, 1), L('essenceEmber', 4, 8, 1)], coins: [240, 380] });
reg({ key: 'bossFabrik', name: 'F4BR-1K, Foundry Tyrant', archetype: 'walker', plan: 'turret', boss: true, hp: 4000, dmg: 38, defense: 30, speed: 2.6, scale: 3, color: 0x54392a, color2: 0xb8c4cc, knockbackResist: 1, castRate: 1.2, projectile: { look: 'gear', speed: 22, gravity: 0, pierce: 2, color: 0xb8c4cc }, drops: [L('ferroxBar', 4, 8, 1), L('gearStaff', 1, 1, 0.25), L('circuit', 4, 8, 1)], coins: [280, 420] });
reg({ key: 'bossZephyr', name: 'The Zephyr Court', archetype: 'flyer', plan: 'flyer', boss: true, hp: 3400, dmg: 36, defense: 18, speed: 9, scale: 2.4, color: 0xdfe8f5, color2: 0xfff0a0, knockbackResist: 1, castRate: 1.4, projectile: { look: 'feather', speed: 18, gravity: 0, homing: 1.2, color: 0xfff0a0 }, drops: [L('auraliteBar', 4, 8, 1), L('galePiercer', 1, 1, 0.33), L('featherGale', 4, 10, 1)], coins: [240, 380] });

// ---------------------------------------------------------------------------
// Elder variants: tougher versions of every spawnable creature (auto-generated)
// ---------------------------------------------------------------------------
const bases = [...defs];
for (const e of bases) {
  if (e.boss || e.archetype === 'minion' || !e.spawn) continue;
  reg({
    ...e,
    key: `elder_${e.key}`,
    name: `Elder ${e.name}`,
    hp: Math.round(e.hp * 1.7),
    dmg: Math.round(e.dmg * 1.35),
    defense: e.defense + 3,
    speed: e.speed * 1.1,
    scale: e.scale * 1.2,
    coins: [e.coins[0] * 2, e.coins[1] * 2],
    drops: [...e.drops.map((d) => ({ ...d, chance: Math.min(1, d.chance * 1.4) })), L('coin', 5, 15, 0.5)],
    spawn: { ...e.spawn, weight: Math.max(1, Math.round(e.spawn.weight * 0.12)) },
  });
}

// ---------------------------------------------------------------------------
// Registry API
// ---------------------------------------------------------------------------
export const ENEMY_DEFS: readonly EnemyDef[] = defs;

export function enemyByKey(key: string): EnemyDef {
  const i = byKey.get(key);
  if (i === undefined) throw new Error(`unknown enemy key: ${key}`);
  return defs[i];
}

export function enemyExists(key: string): boolean {
  return byKey.has(key);
}

export const ENEMY_COUNT = defs.length;
