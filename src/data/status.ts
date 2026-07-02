/** Status effect definitions. Systems read these; nothing is hardcoded per effect. */

export interface StatusDef {
  key: string;
  name: string;
  color: number;
  bad: boolean;
  /** HP change per second (negative = damage). */
  hpPerSec?: number;
  /** Movement speed multiplier. */
  speedMult?: number;
  /** Outgoing damage multiplier. */
  dmgMult?: number;
  /** Flat defense bonus. */
  defense?: number;
  /** Stamina regen multiplier. */
  staminaMult?: number;
  /** Emitted light radius (nightvision, glow). */
  light?: number;
  /** Body temperature nudged toward comfort (+) or applied as env shift. */
  tempShift?: number;
  /** Negates fall damage. */
  featherfall?: boolean;
  /** Breathe underwater. */
  gills?: boolean;
  /** Removes all bad effects on application. */
  cleanse?: boolean;
}

const list: StatusDef[] = [
  { key: 'poison', name: 'Poisoned', color: 0x6a8a4a, bad: true, hpPerSec: -3 },
  { key: 'burning', name: 'Burning', color: 0xff6a33, bad: true, hpPerSec: -5 },
  { key: 'freezing', name: 'Freezing', color: 0x9ff0ff, bad: true, speedMult: 0.6, staminaMult: 0.5 },
  { key: 'bleeding', name: 'Bleeding', color: 0xc43a3a, bad: true, hpPerSec: -2 },
  { key: 'slow', name: 'Slowed', color: 0xd8d8e0, bad: true, speedMult: 0.55 },
  { key: 'weak', name: 'Weakened', color: 0x8a8f98, bad: true, dmgMult: 0.7 },
  { key: 'hypothermia', name: 'Hypothermia', color: 0x7fb4c8, bad: true, hpPerSec: -2, speedMult: 0.7 },
  { key: 'heatstroke', name: 'Heatstroke', color: 0xd97f3d, bad: true, hpPerSec: -2, staminaMult: 0.4 },
  { key: 'regen', name: 'Regeneration', color: 0xe07fa0, bad: false, hpPerSec: 4 },
  { key: 'haste', name: 'Haste', color: 0x58b04c, bad: false, speedMult: 1.25 },
  { key: 'ironhide', name: 'Ironhide', color: 0xb8b2a8, bad: false, defense: 8 },
  { key: 'nightvision', name: 'Nightsight', color: 0x9fe8d0, bad: false, light: 10 },
  { key: 'featherfall', name: 'Featherfall', color: 0xfff0a0, bad: false, featherfall: true },
  { key: 'gills', name: 'Gills', color: 0x7fd0e8, bad: false, gills: true },
  { key: 'warmed', name: 'Warmed', color: 0xff8a50, bad: false, tempShift: 12 },
  { key: 'cooled', name: 'Cooled', color: 0x9ff0ff, bad: false, tempShift: -12 },
  { key: 'wellfed', name: 'Well Fed', color: 0xd9a75c, bad: false, hpPerSec: 1, dmgMult: 1.05 },
  { key: 'battle', name: 'Battle Fury', color: 0xc44a4a, bad: false, dmgMult: 1.15 },
  { key: 'cleanse', name: 'Cleansed', color: 0xe8f0f5, bad: false, cleanse: true },
];

const byKey = new Map(list.map((s) => [s.key, s]));

export const STATUS_DEFS: readonly StatusDef[] = list;

export function statusByKey(key: string): StatusDef {
  const s = byKey.get(key);
  if (!s) throw new Error(`unknown status: ${key}`);
  return s;
}

export function statusExists(key: string): boolean {
  return byKey.has(key);
}
