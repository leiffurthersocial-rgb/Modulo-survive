/** Shared content interfaces. Data files declare these; systems interpret them. */

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

/** Pattern painters understood by render/textures.ts. */
export type BlockStyle =
  | 'soil'
  | 'grassTop'
  | 'stone'
  | 'sand'
  | 'snow'
  | 'ice'
  | 'brick'
  | 'plank'
  | 'plate'
  | 'ore'
  | 'crystal'
  | 'glass'
  | 'leaf'
  | 'log'
  | 'plant'
  | 'furniture'
  | 'torch'
  | 'rope'
  | 'platform'
  | 'door'
  | 'chest'
  | 'machine'
  | 'altar'
  | 'portal'
  | 'wallPlain'
  | 'cloud'
  | 'web';

export type FurnitureKind =
  | 'door'
  | 'chest'
  | 'bed'
  | 'table'
  | 'chair'
  | 'lamp'
  | 'campfire'
  | 'station'
  | 'portalFrame'
  | 'portalCore'
  | 'altar'
  | 'generator'
  | 'extractor'
  | 'sprinkler'
  | 'teleport'
  | 'trophy';

export type StationKind =
  | 'workbench'
  | 'forge'
  | 'kitchen'
  | 'alchemy'
  | 'engineering'
  | 'enchanting'
  | 'fabricator';

export type ToolType = 'pick' | 'axe' | 'hoe' | 'hammer' | 'any';

export interface BlockDef {
  key: string;
  name: string;
  /** Base color (0xRRGGBB) driving the procedural atlas and the minimap. */
  color: number;
  /** Secondary color for the painter (ore veins, grass tops, glows…). */
  color2?: number;
  style: BlockStyle;
  solid: boolean;
  /** One-way platform collision. */
  platform?: boolean;
  /** Seconds of mining with power-matched tool at speed 1. */
  hardness: number;
  tool?: ToolType;
  /** Minimum tool power required to break at all. */
  minPower?: number;
  /** Item key dropped; `null` = nothing; omitted = item with same key. */
  drops?: string | null;
  /** Emissive light 0..15. */
  light?: number;
  /** Can entities climb it (ropes, vines, ladders)? */
  climbable?: boolean;
  /** Destroyed when a supporting block below/behind disappears or liquid hits it. */
  fragile?: boolean;
  /** Must sit on solid ground to be placed. */
  needsFloor?: boolean;
  furniture?: FurnitureKind;
  station?: StationKind;
  /** Registered as a background wall (placed in wall layer). */
  wall?: boolean;
  /** Light attenuation override (defaults from solid). */
  opacity?: number;
  /** Which dimension's portal this frame block keys (dimension key). */
  portalTo?: string;
  /** Crop metadata: growth stages and yielded item. */
  crop?: { stages: number; stage: number; yields: string; yieldCount: [number, number]; seed: string };
  /** Suppress automatic placeable-item registration (crop stages, open doors…). */
  noItem?: boolean;
  /** Contact damage (spikes) or slow (webs). */
  hazard?: { dmg?: number; slow?: number };
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export type Rarity = 0 | 1 | 2 | 3 | 4; // common, uncommon, rare, epic, mythic

export type ItemKind =
  | 'block'
  | 'wall'
  | 'tool'
  | 'weapon'
  | 'armor'
  | 'accessory'
  | 'consumable'
  | 'material'
  | 'seed'
  | 'summon'
  | 'coin'
  | 'bucket';

export type WeaponType = 'sword' | 'spear' | 'bow' | 'wand' | 'summonStaff' | 'thrown';

export interface ProjectileSpec {
  /** Sprite/palette key for the projectile painter. */
  look: 'arrow' | 'bolt' | 'orb' | 'shard' | 'flame' | 'spore' | 'gear' | 'feather';
  speed: number; // tiles/s
  gravity: number; // 0..1 multiplier of world gravity
  pierce?: number;
  homing?: number; // turn rate rad/s
  explode?: number; // blast radius in tiles
  status?: { key: string; duration: number; chance: number };
  color: number;
}

export interface ItemDef {
  key: string;
  name: string;
  desc?: string;
  kind: ItemKind;
  rarity: Rarity;
  maxStack: number;
  /** Coin value for shops (buy price ≈ value, sell ≈ value/5). */
  value: number;
  /** Block key this item places (kind block/wall). */
  block?: string;
  tool?: { type: Exclude<ToolType, 'any'>; power: number; speed: number };
  weapon?: {
    type: WeaponType;
    dmg: number;
    /** Attacks per second. */
    speed: number;
    knockback: number;
    critBonus?: number; // added crit chance 0..1
    mana?: number;
    projectile?: ProjectileSpec;
    /** Summon staffs: enemy-like minion key. */
    minion?: string;
  };
  armor?: { slot: 'head' | 'chest' | 'legs'; defense: number; warmth?: number };
  accessory?: { effect: AccessoryEffect; magnitude: number };
  food?: { hunger: number; buffs?: { key: string; duration: number }[] };
  potion?: {
    heal?: number;
    mana?: number;
    effects?: { key: string; duration: number }[];
  };
  /** Boss or event summon item. */
  summons?: string;
  /** Item painter hints. */
  icon: IconSpec;
}

export type AccessoryEffect =
  | 'moveSpeed'
  | 'jumpBoost'
  | 'featherfall'
  | 'defense'
  | 'critChance'
  | 'manaMax'
  | 'staminaRegen'
  | 'warmth'
  | 'cooling'
  | 'gills'
  | 'lightAura'
  | 'magnet'
  | 'thorns';

export interface IconSpec {
  /** Painter used by render/textures.ts for the inventory icon. */
  shape:
    | 'block'
    | 'bar'
    | 'ore'
    | 'gem'
    | 'pick'
    | 'axe'
    | 'hoe'
    | 'hammer'
    | 'sword'
    | 'spear'
    | 'bow'
    | 'wand'
    | 'staff'
    | 'helmet'
    | 'chestplate'
    | 'legs'
    | 'ring'
    | 'potion'
    | 'food'
    | 'seed'
    | 'coin'
    | 'scroll'
    | 'part'
    | 'bucket'
    | 'arrow';
  color: number;
  color2?: number;
}

// ---------------------------------------------------------------------------
// Crafting
// ---------------------------------------------------------------------------

export interface RecipeDef {
  out: string;
  count: number;
  ins: [string, number][];
  station?: StationKind;
  /** Progression flag required (boss kills etc.). */
  flag?: string;
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

export type AIArchetype =
  | 'walker'
  | 'hopper'
  | 'flyer'
  | 'diver'
  | 'floater'
  | 'caster'
  | 'charger'
  | 'spitter'
  | 'burrower'
  | 'swimmer'
  | 'turret'
  | 'minion';

export type SpritePlan = 'blob' | 'humanoid' | 'flyer' | 'quad' | 'wisp' | 'turret' | 'orb';

export interface LootEntry {
  item: string;
  min: number;
  max: number;
  chance: number;
}

export interface SpawnRule {
  /** Biome keys; empty = all. */
  biomes?: string[];
  /** Dimension keys; empty = overworld only unless dims specified. */
  dims?: string[];
  /** Strata: 'surface' | 'underground' | 'cavern' | 'deep' | 'sky'. */
  strata?: string[];
  night?: boolean; // spawns only at night
  day?: boolean; // spawns only at day
  event?: string; // spawns only during this event
  weight: number;
}

export interface EnemyDef {
  key: string;
  name: string;
  archetype: AIArchetype;
  plan: SpritePlan;
  hp: number;
  dmg: number;
  defense: number;
  speed: number; // tiles/s horizontal reference speed
  scale: number; // 1 = 16px body
  color: number;
  color2?: number;
  knockbackResist?: number; // 0..1
  projectile?: ProjectileSpec;
  /** Seconds between ranged attacks (caster/spitter/turret). */
  castRate?: number;
  drops: LootEntry[];
  coins: [number, number];
  spawn?: SpawnRule;
  /** Status applied on contact. */
  inflicts?: { key: string; duration: number; chance: number };
  boss?: boolean;
}

// ---------------------------------------------------------------------------
// Characters, NPCs, quests, dimensions
// ---------------------------------------------------------------------------

export interface CharacterAppearance {
  skin: number;
  hair: number;
  hairStyle: 'short' | 'medium' | 'styled' | 'middlePart';
  eyes: number;
  shirt: number;
  pants: number;
  glasses?: boolean;
  goatee?: boolean;
  /** 1 = default; >1 taller, <1 shorter. */
  height: number;
  /** 1 = default; >1 broader. */
  build: number;
}

export type TraitKey =
  | 'builder'
  | 'hunter'
  | 'explorer'
  | 'warrior'
  | 'engineer'
  | 'gatherer'
  | 'scholar'
  | 'merchant';

export interface CharacterDef {
  key: string;
  name: string;
  trait: TraitKey;
  traitName: string;
  traitDesc: string;
  appearance: CharacterAppearance;
  /** Multipliers applied by systems; missing = 1. */
  bonuses: Partial<Record<BonusKey, number>>;
  startItems: [string, number][];
}

export type BonusKey =
  | 'buildSpeed'
  | 'craftSpeed'
  | 'bowDamage'
  | 'critChance'
  | 'moveSpeed'
  | 'visionRadius'
  | 'climb'
  | 'meleeDamage'
  | 'maxHp'
  | 'defense'
  | 'machineSpeed'
  | 'electronicsCost'
  | 'mineSpeed'
  | 'resourceYield'
  | 'research'
  | 'manaCost'
  | 'craftWaste'
  | 'shopPrices'
  | 'lootLuck'
  | 'tracking';

export interface NPCDef {
  key: string;
  name: string;
  title: string;
  appearance: CharacterAppearance;
  dialogue: string[];
  eventDialogue?: Record<string, string[]>;
  shop?: [string, number][]; // item key, price override (0 = item value)
  quests?: string[]; // quest keys offered
  biomeLikes: string[];
  biomeDislikes: string[];
  /** Progression flag required before this NPC arrives. */
  arrivesWhen?: string;
}

export interface QuestDef {
  key: string;
  name: string;
  desc: string;
  giver?: string; // NPC key; omitted = auto milestone quest
  kind: 'gather' | 'kill' | 'reach' | 'craft' | 'flag';
  target: string; // item key / enemy key / flag / depth marker
  count: number;
  rewards: [string, number][];
  next?: string; // follow-up quest key
}

export interface BiomeDef {
  key: string;
  name: string;
  /** Climate selector center: temperature, humidity in [-1, 1]. */
  temp: number;
  humid: number;
  topsoil: string;
  subsoil: string;
  treeDensity: number;
  treeSpecies?: string; // log/leaf family key
  /** Ambient temperature °C-like scalar for survival. */
  ambient: number;
  skyTint?: number;
  parallaxHue: number;
  weather: ('rain' | 'storm' | 'snow' | 'sandstorm' | 'ashfall' | 'fog' | 'aurora')[];
}

export interface DimensionDef {
  key: string;
  name: string;
  /** Terrain overrides. */
  surfaceBase: number;
  amplitude: number; // macro-relief multiplier
  caveDensity: number; // multiplier on cave thresholds
  biomes: string[]; // biome keys valid here
  stone: string; // base stone block key
  liquid: 'water' | 'lava' | 'none';
  skyTop: number;
  skyBottom: number;
  /** 0..1: base sky light (Void is dim even at noon). */
  skyLight: number;
  exclusiveOre: string; // block key
  ambient: number; // survival temperature baseline
  musicKey: string; // scale/timbre selector for audio/music.ts
  weather: BiomeDef['weather'];
  /** 'islands' replaces column terrain with floating blobs (Sky, Void). */
  terrainMode: 'columns' | 'islands';
  bossKey?: string;
  /** Frame block key that keys portals to this dimension. */
  frameBlock: string;
}
