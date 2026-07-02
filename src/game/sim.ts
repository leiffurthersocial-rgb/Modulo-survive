/**
 * Shared simulation context interface + event map. Systems depend on this
 * type; game.ts implements it. Every event payload is serializable — this is
 * the future network boundary (docs/NETWORKING.md).
 */

import type { EventBus } from '../core/events';
import type { RNG } from '../core/rng';
import type { World } from '../world/world';
import type { Entity } from './entities';
import type { Inventory } from './inventory';
import type { CharacterDef, BonusKey } from '../data/types';

export interface GameEvents extends Record<string, unknown> {
  damageNumber: { x: number; y: number; amount: number; crit: boolean; color: number };
  sound: { key: string; x?: number; y?: number };
  particles: { key: string; x: number; y: number; count: number; color?: number };
  screenShake: { amount: number };
  banner: { title: string; sub?: string; color?: number };
  bossBar: { name: string; hp: number; maxHp: number } | null;
  openChest: { x: number; y: number } | null;
  dialogue: { npcKey: string; text: string } | null;
  playerDied: { cause: string };
  tileBroken: { x: number; y: number; blockKey: string };
  tilePlaced: { x: number; y: number; blockKey: string };
  pickup: { itemKey: string; count: number };
  crafted: { itemKey: string; count: number };
  enemyKilled: { key: string };
  questUpdate: { questKey: string; done: boolean };
  portalUsed: { toDim: string };
  eventStarted: { key: string; name: string };
  eventEnded: { key: string };
  weatherChanged: { key: string };
  musicCue: { key: string };
}

export interface PlayerData {
  character: CharacterDef;
  inventory: Inventory;
  armor: Inventory; // 3 slots
  accessories: Inventory; // 4 slots
  hotbarIndex: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  hunger: number;
  breath: number;
  temperature: number; // body temp, comfort = 0
  useCooldown: number;
  swingT: number; // >0 while a melee swing animates
  swingAngle: number;
  dodgeT: number;
  dodgeCd: number;
  mineX: number;
  mineY: number;
  mineProgress: number;
  respawnX: number;
  respawnY: number;
  respawnT: number;
  seenItems: Set<string>;
  minionCount: number;
  placedCount: number;
  coins: number;
  canStep: boolean;
  dropThrough: boolean;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  jumpPressed: boolean;
  dodgePressed: boolean;
  use: boolean; // primary (mouse left) held
  usePressed: boolean;
  interactPressed: boolean; // secondary (mouse right)
  aimX: number; // world tile coords
  aimY: number;
  hotbar: number; // -1 = unchanged
}

/** What systems can see and do. Implemented by Game. */
export interface Sim {
  /** World seed (numeric hash) — all generation context derives from it. */
  seed: number;
  world: World; // active dimension's world
  dimKey: string;
  entities: Entity[];
  player: Entity; // player.data is PlayerData
  bus: EventBus<GameEvents>;
  rng: RNG; // simulation randomness (seeded)
  flags: Set<string>;
  /** 0..1 day fraction; 0.25–0.75 ≈ daytime. */
  timeOfDay: number;
  day: number;
  /** 0..1 sky brightness incl. weather/events/dimension. */
  dayLight(): number;
  isNight(): boolean;
  /** Active world event key or null. */
  activeEvent: string | null;
  weather: string; // 'clear' | 'rain' | ...
  bonus(key: BonusKey): number;
  addItem(key: string, count: number): void;
  stratumAt(x: number, y: number): string;
  surfaceAt(x: number): number;
  killCounter: Map<string, number>;
}
