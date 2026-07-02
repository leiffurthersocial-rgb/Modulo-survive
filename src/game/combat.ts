/**
 * Damage, crits, knockback, status effects and death handling for all entities.
 * Formula: taken = max(1, dmg − defense/2), crits ×1.8 (DESIGN.md §9).
 */

import { statusByKey } from '../data/status';
import { enemyByKey } from '../data/enemies';
import { itemByKey } from '../data/items';
import { makeEntity, type Entity } from './entities';
import type { Sim, PlayerData } from './sim';

export const CRIT_MULT = 1.8;
export const BASE_CRIT = 0.05;

export interface DamageOpts {
  knockX?: number;
  knockY?: number;
  crit?: boolean;
  cause?: string;
  /** Bypass iframes (status ticks, hazards). */
  dot?: boolean;
  color?: number;
}

export function entityDefense(e: Entity, sim: Sim): number {
  if (e.kind === 'player') {
    const pd = e.data as PlayerData;
    let d = pd.character.bonuses.defense ?? 0; // Warrior trait: flat defense
    for (const s of pd.armor.slots) {
      if (s) d += itemByKey(s.key).armor?.defense ?? 0;
    }
    for (const s of pd.accessories.slots) {
      if (s) {
        const acc = itemByKey(s.key).accessory;
        if (acc?.effect === 'defense') d += acc.magnitude;
      }
    }
    for (const st of e.statuses) {
      d += statusByKey(st.key).defense ?? 0;
    }
    return d;
  }
  if (e.kind === 'enemy' || e.kind === 'npc') {
    return e.data.defKey ? enemyByKey(e.data.defKey).defense : 0;
  }
  return 0;
}

export function applyDamage(sim: Sim, target: Entity, raw: number, opts: DamageOpts = {}): number {
  if (target.dead) return 0;
  if (!opts.dot && target.iframes > 0) return 0;
  const defense = entityDefense(target, sim);
  let dmg = Math.max(1, Math.round(raw - defense / 2));
  if (opts.crit) dmg = Math.round(dmg * CRIT_MULT);
  target.hp -= dmg;
  if (!opts.dot) {
    target.iframes = target.kind === 'player' ? 0.7 : 0.25;
    const resist = target.data.defKey ? (enemyByKey(target.data.defKey).knockbackResist ?? 0) : 0;
    if (opts.knockX) target.vx += opts.knockX * (1 - resist);
    if (opts.knockY) target.vy += opts.knockY * (1 - resist);
  }
  sim.bus.emit('damageNumber', {
    x: target.x,
    y: target.y - target.h,
    amount: dmg,
    crit: !!opts.crit,
    color: opts.color ?? (target.kind === 'player' ? 0xd94f4f : 0xffe084),
  });
  if (target.hp <= 0) {
    onDeath(sim, target, opts.cause ?? 'damage');
  } else if (!opts.dot) {
    sim.bus.emit('sound', { key: target.kind === 'player' ? 'hurtPlayer' : 'hurt', x: target.x, y: target.y });
  }
  return dmg;
}

export function addStatus(target: Entity, key: string, duration: number): void {
  const def = statusByKey(key);
  if (def.cleanse) {
    target.statuses = target.statuses.filter((s) => !statusByKey(s.key).bad);
    return;
  }
  const existing = target.statuses.find((s) => s.key === key);
  if (existing) existing.t = Math.max(existing.t, duration);
  else target.statuses.push({ key, t: duration });
}

export function hasStatus(target: Entity, key: string): boolean {
  return target.statuses.some((s) => s.key === key);
}

/** Aggregate a numeric status modifier across active effects. */
export function statusMult(target: Entity, field: 'speedMult' | 'dmgMult' | 'staminaMult'): number {
  let m = 1;
  for (const s of target.statuses) {
    const v = statusByKey(s.key)[field];
    if (v !== undefined) m *= v;
  }
  return m;
}

export function tickStatuses(sim: Sim, e: Entity, dt: number): void {
  for (let i = e.statuses.length - 1; i >= 0; i--) {
    const s = e.statuses[i];
    s.t -= dt;
    const def = statusByKey(s.key);
    if (def.hpPerSec) {
      if (def.hpPerSec < 0) {
        // Damage-over-time accumulates fractionally, applied per second-ish tick.
        e.data._dot = (e.data._dot ?? 0) + -def.hpPerSec * dt;
        if (e.data._dot >= 1) {
          const whole = Math.floor(e.data._dot);
          e.data._dot -= whole;
          applyDamage(sim, e, whole + entityDefense(e, sim) / 2, { dot: true, cause: def.key, color: def.color });
        }
      } else {
        e.hp = Math.min(e.maxHp, e.hp + def.hpPerSec * dt);
      }
    }
    if (s.t <= 0) e.statuses.splice(i, 1);
  }
}

function onDeath(sim: Sim, e: Entity, cause: string): void {
  if (e.kind === 'player') {
    sim.bus.emit('playerDied', { cause });
    return; // game handles respawn; entity persists
  }
  e.dead = true;
  sim.bus.emit('particles', { key: 'death', x: e.x, y: e.y, count: 14, color: e.data.color ?? 0xd94f4f });
  sim.bus.emit('sound', { key: e.data.defKey && enemyByKey(e.data.defKey).boss ? 'bossDie' : 'die', x: e.x, y: e.y });

  if (e.kind === 'enemy' && e.data.defKey) {
    const def = enemyByKey(e.data.defKey);
    sim.killCounter.set(def.key, (sim.killCounter.get(def.key) ?? 0) + 1);
    sim.bus.emit('enemyKilled', { key: def.key });
    // Loot rolls (lootLuck trait multiplies chances).
    const luck = sim.bonus('lootLuck');
    for (const d of def.drops) {
      if (sim.rng.next() < Math.min(1, d.chance * luck)) {
        spawnDrop(sim, e.x, e.y, d.item, sim.rng.int(d.min, d.max));
      }
    }
    const coins = sim.rng.int(def.coins[0], def.coins[1]);
    if (coins > 0) spawnDrop(sim, e.x, e.y, 'coin', coins);
    if (def.boss) {
      sim.flags.add(`boss.${def.key.replace(/^boss/, '').toLowerCase()}`);
      sim.bus.emit('bossBar', null);
      sim.bus.emit('banner', { title: `${def.name} has fallen`, color: 0xe8c84a });
      sim.bus.emit('musicCue', { key: 'victory' });
    }
  }
}

export function spawnDrop(sim: Sim, x: number, y: number, itemKey: string, count: number): void {
  if (count <= 0) return;
  // Merge with a nearby drop of the same item to limit entity count.
  for (const other of sim.entities) {
    if (other.kind === 'drop' && !other.dead && other.data.itemKey === itemKey) {
      const dx = other.x - x;
      const dy = other.y - y;
      if (dx * dx + dy * dy < 2) {
        other.data.count += count;
        return;
      }
    }
  }
  const drop = makeEntity('drop', x, y, 0.28, 0.28);
  drop.vx = sim.rng.float(-3, 3);
  drop.vy = sim.rng.float(-6, -2);
  drop.data = { itemKey, count, age: 0 };
  sim.entities.push(drop);
}
