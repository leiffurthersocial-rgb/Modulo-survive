/**
 * Minimal external store for React (useSyncExternalStore). The game mutates
 * snapshots here at ~10 Hz; React never touches game internals directly.
 */

import { useSyncExternalStore } from 'react';
import type { Slot } from '../game/inventory';

export type Screen = 'menu' | 'charSelect' | 'newWorld' | 'worldSelect' | 'playing';
export type Panel = null | 'inventory' | 'map' | 'quests' | 'settings' | 'pause';

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  hunger: number;
  breath: number;
  temperature: number;
  coins: number;
  hotbarIndex: number;
  hotbar: (Slot | null)[];
  buffs: { key: string; t: number }[];
  timeOfDay: number;
  day: number;
  depth: number;
  biome: string;
  dead: boolean;
  weather: string;
  eventName: string | null;
}

export interface Banner {
  id: number;
  title: string;
  sub?: string;
  color?: number;
}

export interface UIState {
  screen: Screen;
  panel: Panel;
  chest: { x: number; y: number } | null;
  dialogueNpc: string | null;
  bossBar: { name: string; hp: number; maxHp: number } | null;
  banners: Banner[];
  hud: HudSnapshot;
  /** bump to force inventory-panel rerenders after item moves */
  invVersion: number;
  selectedCharacter: string;
  fps: number;
  loading: string | null;
}

const initialHud: HudSnapshot = {
  hp: 100,
  maxHp: 100,
  mana: 60,
  maxMana: 60,
  stamina: 100,
  maxStamina: 100,
  hunger: 100,
  breath: 100,
  temperature: 18,
  coins: 0,
  hotbarIndex: 0,
  hotbar: new Array(10).fill(null),
  buffs: [],
  timeOfDay: 0.3,
  day: 0,
  depth: 0,
  biome: 'meadow',
  dead: false,
  weather: 'clear',
  eventName: null,
};

let state: UIState = {
  screen: 'menu',
  panel: null,
  chest: null,
  dialogueNpc: null,
  bossBar: null,
  banners: [],
  hud: initialHud,
  invVersion: 0,
  selectedCharacter: 'robin',
  fps: 0,
  loading: null,
};

const listeners = new Set<() => void>();
let bannerId = 1;

export function getUI(): UIState {
  return state;
}

export function setUI(patch: Partial<UIState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function bumpInventory(): void {
  setUI({ invVersion: state.invVersion + 1 });
}

export function pushBanner(title: string, sub?: string, color?: number): void {
  const banner: Banner = { id: bannerId++, title, sub, color };
  setUI({ banners: [...state.banners.slice(-2), banner] });
  setTimeout(() => {
    setUI({ banners: getUI().banners.filter((b) => b.id !== banner.id) });
  }, 4200);
}

export function useUI(): UIState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
