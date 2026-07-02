/** Projectile spawning and simulation: arrows, bolts, enemy shots, explosions. */

import { GRAVITY } from '../data/constants';
import type { ProjectileSpec } from '../data/types';
import { makeEntity, type Entity } from './entities';
import { addStatus, applyDamage } from './combat';
import type { Sim } from './sim';

export interface ProjectileData {
  spec: ProjectileSpec;
  dmg: number;
  crit: boolean;
  friendly: boolean; // true = hurts enemies, false = hurts the player
  pierceLeft: number;
  life: number;
  hitIds: Set<number>;
  knockback: number;
}

export function spawnProjectile(
  sim: Sim,
  friendly: boolean,
  x: number,
  y: number,
  angle: number,
  spec: ProjectileSpec,
  dmg: number,
  opts: { crit?: boolean; knockback?: number; speedMult?: number } = {},
): Entity {
  const p = makeEntity('projectile', x, y, 0.22, 0.22);
  const speed = spec.speed * (opts.speedMult ?? 1);
  p.vx = Math.cos(angle) * speed;
  p.vy = Math.sin(angle) * speed;
  p.noclip = true; // manual tile check below (finer than AABB sweep)
  p.gravityMult = spec.gravity;
  const data: ProjectileData = {
    spec,
    dmg,
    crit: !!opts.crit,
    friendly,
    pierceLeft: spec.pierce ?? 0,
    life: 5,
    hitIds: new Set(),
    knockback: opts.knockback ?? 2,
  };
  p.data = data;
  sim.entities.push(p);
  return p;
}

export function updateProjectiles(sim: Sim, dt: number): void {
  for (const p of sim.entities) {
    if (p.kind !== 'projectile' || p.dead) continue;
    const d = p.data as ProjectileData;
    d.life -= dt;
    if (d.life <= 0) {
      p.dead = true;
      continue;
    }

    // Homing: steer toward the nearest valid target.
    if (d.spec.homing) {
      const target = d.friendly ? nearestEnemy(sim, p.x, p.y, 14) : sim.player;
      if (target) {
        const want = Math.atan2(target.y - p.y, target.x - p.x);
        const cur = Math.atan2(p.vy, p.vx);
        let diff = want - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = Math.sign(diff) * Math.min(Math.abs(diff), d.spec.homing * dt);
        const speed = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(cur + turn) * speed;
        p.vy = Math.sin(cur + turn) * speed;
      }
    }

    p.vy += GRAVITY * d.spec.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.facing = p.vx >= 0 ? 1 : -1;

    // Tile hit.
    if (sim.world.isSolid(Math.floor(p.x), Math.floor(p.y))) {
      impact(sim, p, d);
      continue;
    }

    // Entity hits.
    if (d.friendly) {
      for (const e of sim.entities) {
        if ((e.kind !== 'enemy' && e.kind !== 'particleEmitter') || e.dead || d.hitIds.has(e.id)) continue;
        if (Math.abs(e.x - p.x) < e.w + p.w && Math.abs(e.y - p.y) < e.h + p.h) {
          hitEntity(sim, p, d, e);
          if (p.dead) break;
        }
      }
    } else {
      const pl = sim.player;
      if (!d.hitIds.has(pl.id) && pl.iframes <= 0 && Math.abs(pl.x - p.x) < pl.w + p.w && Math.abs(pl.y - p.y) < pl.h + p.h) {
        hitEntity(sim, p, d, pl);
      }
    }
  }
}

function hitEntity(sim: Sim, p: Entity, d: ProjectileData, target: Entity): void {
  d.hitIds.add(target.id);
  const kx = Math.sign(p.vx) * d.knockback;
  applyDamage(sim, target, d.dmg, { crit: d.crit, knockX: kx, knockY: -d.knockback * 0.4, color: d.spec.color });
  if (d.spec.status && sim.rng.next() < d.spec.status.chance) {
    addStatus(target, d.spec.status.key, d.spec.status.duration);
  }
  if (d.pierceLeft > 0) d.pierceLeft--;
  else impact(sim, p, d);
}

function impact(sim: Sim, p: Entity, d: ProjectileData): void {
  p.dead = true;
  sim.bus.emit('particles', { key: 'impact', x: p.x, y: p.y, count: 6, color: d.spec.color });
  sim.bus.emit('sound', { key: 'impact', x: p.x, y: p.y });
  if (d.spec.explode) {
    sim.bus.emit('particles', { key: 'explosion', x: p.x, y: p.y, count: 20, color: d.spec.color });
    sim.bus.emit('screenShake', { amount: 4 });
    const r = d.spec.explode;
    const targets = d.friendly ? sim.entities.filter((e) => e.kind === 'enemy') : [sim.player];
    for (const e of targets) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy <= r * r) {
        applyDamage(sim, e, d.dmg, { knockX: Math.sign(dx) * 6, knockY: -4 });
      }
    }
  }
}

export function nearestEnemy(sim: Sim, x: number, y: number, r: number): Entity | null {
  let best: Entity | null = null;
  let bestD = r * r;
  for (const e of sim.entities) {
    if (e.kind !== 'enemy' || e.dead) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      bestD = d2;
      best = e;
    }
  }
  return best;
}
