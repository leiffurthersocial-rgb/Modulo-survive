/**
 * Enemy AI: twelve archetype behaviors parameterized by EnemyDef
 * (data/enemies.ts). Enemies keep their state in entity.data.
 */

import { enemyByKey } from '../data/enemies';
import type { EnemyDef } from '../data/types';
import { makeEntity, type Entity } from './entities';
import { addStatus, applyDamage, statusMult } from './combat';
import { applyGravity, moveEntity } from './physics';
import { spawnProjectile } from './projectiles';
import type { Sim } from './sim';

export interface EnemyData {
  defKey: string;
  color: number;
  aggro: boolean;
  timer: number; // generic behavior timer
  castCd: number;
  patrolDir: number;
  canStep: boolean;
  spawnedAt: number;
  /** minions: owner entity id */
  ownerId?: number;
  phase?: number;
}

export function spawnEnemy(sim: Sim, key: string, x: number, y: number): Entity {
  const def = enemyByKey(key);
  const size = 0.45 * def.scale;
  const e = makeEntity('enemy', x, y, size, def.plan === 'humanoid' ? size * 1.4 : size);
  e.hp = def.hp;
  e.maxHp = def.hp;
  e.noclip = def.archetype === 'floater' || def.archetype === 'minion';
  const data: EnemyData = {
    defKey: key,
    color: def.color,
    aggro: false,
    timer: sim.rng.float(0, 2),
    castCd: sim.rng.float(0.5, def.castRate ?? 2),
    patrolDir: sim.rng.chance(0.5) ? 1 : -1,
    canStep: true,
    spawnedAt: sim.day + sim.timeOfDay,
  };
  e.data = data;
  sim.entities.push(e);
  if (def.boss) {
    sim.bus.emit('bossBar', { name: def.name, hp: def.hp, maxHp: def.hp });
    sim.bus.emit('musicCue', { key: 'boss' });
    sim.bus.emit('banner', { title: def.name, sub: 'has awakened', color: def.color2 ?? 0xd94f4f });
  }
  return e;
}

const AGGRO_RANGE = 34;
const DEAGGRO_RANGE = 55;

export function updateEnemies(sim: Sim, dt: number): void {
  const player = sim.player;
  for (const e of sim.entities) {
    if (e.kind !== 'enemy' || e.dead) continue;
    const d = e.data as EnemyData;
    const def = enemyByKey(d.defKey);
    if (def.boss) continue; // bosses run their own scripts (bosses.ts)

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < AGGRO_RANGE) d.aggro = true;
    else if (dist > DEAGGRO_RANGE) d.aggro = false;

    // Despawn far-away enemies.
    if (dist > 80) {
      e.dead = true;
      continue;
    }

    const speed = def.speed * statusMult(e, 'speedMult');
    d.timer -= dt;
    d.castCd -= dt;

    switch (def.archetype) {
      case 'walker':
        walkerAI(sim, e, d, def, speed, dx, dt);
        break;
      case 'charger': {
        const charging = d.aggro && Math.abs(dy) < 4;
        walkerAI(sim, e, d, def, charging ? speed * 1.6 : speed * 0.6, dx, dt);
        break;
      }
      case 'hopper':
        hopperAI(sim, e, d, speed, dx, dt);
        break;
      case 'flyer':
        flyerAI(sim, e, d, speed, dx, dy, dt, 0);
        break;
      case 'diver':
        diverAI(sim, e, d, speed, dx, dy, dt);
        break;
      case 'floater':
        floaterAI(e, d, speed, dx, dy, dt);
        break;
      case 'caster':
        casterAI(sim, e, d, def, speed, dx, dy, dist, dt);
        break;
      case 'spitter':
        spitterAI(sim, e, d, def, dx, dy, dist, dt);
        break;
      case 'burrower':
        burrowerAI(sim, e, d, speed, dx, dy, dt);
        break;
      case 'swimmer':
        swimmerAI(sim, e, d, speed, dx, dy, dt);
        break;
      case 'turret':
        turretAI(sim, e, d, def, dx, dy, dist, dt);
        break;
      case 'minion':
        minionAI(sim, e, d, def, speed, dt);
        break;
    }

    e.facing = (d.aggro ? dx : d.patrolDir) >= 0 ? 1 : -1;

    // Contact damage (minions never hurt the player).
    if (def.archetype !== 'minion' && player.iframes <= 0 && Math.abs(dx) < e.w + player.w && Math.abs(dy) < e.h + player.h) {
      applyDamage(sim, player, def.dmg, { knockX: Math.sign(-dx) * -6 * Math.sign(dx || 1), knockY: -5, cause: def.name });
      if (def.inflicts && sim.rng.next() < def.inflicts.chance) {
        addStatus(player, def.inflicts.key, def.inflicts.duration);
      }
    }
  }
}

function walkerAI(sim: Sim, e: Entity, d: EnemyData, def: EnemyDef, speed: number, dx: number, dt: number): void {
  const dir = d.aggro ? Math.sign(dx) : d.patrolDir;
  e.vx = dir * speed;
  applyGravity(e, dt);
  e.data.canStep = true;
  const res = moveEntity(sim.world, e, dt);
  if (res.hitWall && e.onGround) {
    // Try a jump over the obstacle; patrollers turn around instead.
    if (d.aggro) e.vy = -12;
    else d.patrolDir *= -1;
  }
  // Patrol edge check: don't walk off cliffs when idle.
  if (!d.aggro && e.onGround && !sim.world.isSolid(Math.floor(e.x + dir * 1.2), Math.floor(e.y + e.h + 0.6))) {
    d.patrolDir *= -1;
  }
}

function hopperAI(sim: Sim, e: Entity, d: EnemyData, speed: number, dx: number, dt: number): void {
  applyGravity(e, dt);
  if (e.onGround) {
    e.vx *= 0.8;
    if (d.timer <= 0) {
      const dir = d.aggro ? Math.sign(dx) : d.patrolDir;
      e.vx = dir * speed * 1.6;
      e.vy = -10 - speed * 0.4;
      d.timer = d.aggro ? 0.9 : 2.2;
      if (Math.abs(dx) < 20) sim.bus.emit('sound', { key: 'hop', x: e.x, y: e.y });
    }
  }
  moveEntity(sim.world, e, dt);
}

function flyerAI(sim: Sim, e: Entity, d: EnemyData, speed: number, dx: number, dy: number, dt: number, hover: number): void {
  const wave = Math.sin((d.timer + e.id) * 3) * 2;
  const tx = d.aggro ? Math.sign(dx) * speed : Math.sin(e.id + d.timer * 0.5) * speed * 0.5;
  const ty = d.aggro ? Math.sign(dy + hover) * speed * 0.7 + wave : wave;
  e.vx += (tx - e.vx) * Math.min(1, dt * 3);
  e.vy += (ty - e.vy) * Math.min(1, dt * 3);
  moveEntity(sim.world, e, dt);
  if (d.timer <= 0) d.timer = 10;
}

function diverAI(sim: Sim, e: Entity, d: EnemyData, speed: number, dx: number, dy: number, dt: number): void {
  if (e.data.diving) {
    // Committed dive along the locked vector.
    moveEntity(sim.world, e, dt);
    if (e.onGround || d.timer <= 0 || e.vx === 0) {
      e.data.diving = false;
      d.timer = 2.5;
    }
    return;
  }
  // Hover above the player, then strike.
  flyerAI(sim, e, d, speed, dx, dy - 6, dt, -6);
  if (d.aggro && d.timer <= 0 && dy > 2) {
    e.data.diving = true;
    const ang = Math.atan2(dy, dx);
    e.vx = Math.cos(ang) * speed * 2;
    e.vy = Math.sin(ang) * speed * 2;
    d.timer = 1.2;
    sim.bus.emit('sound', { key: 'screech', x: e.x, y: e.y });
  }
}

function floaterAI(e: Entity, d: EnemyData, speed: number, dx: number, dy: number, dt: number): void {
  // Drifts through terrain toward the player.
  const dist = Math.hypot(dx, dy) || 1;
  const t = d.aggro ? speed : speed * 0.3;
  e.vx += ((dx / dist) * t - e.vx) * Math.min(1, dt * 1.5);
  e.vy += ((dy / dist) * t - e.vy) * Math.min(1, dt * 1.5) + Math.sin(d.timer * 4 + e.id) * 0.08;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

function casterAI(sim: Sim, e: Entity, d: EnemyData, def: EnemyDef, speed: number, dx: number, dy: number, dist: number, dt: number): void {
  // Keep mid distance; teleport away if crowded, cast on cooldown.
  const dir = dist < 8 ? -Math.sign(dx) : dist > 16 ? Math.sign(dx) : 0;
  e.vx = dir * speed;
  applyGravity(e, dt);
  e.data.canStep = true;
  moveEntity(sim.world, e, dt);
  if (d.aggro && dist < 5 && d.timer <= 0) {
    // Blink to a nearby air pocket.
    for (let tries = 0; tries < 8; tries++) {
      const nx = e.x + sim.rng.float(-12, 12);
      const ny = e.y + sim.rng.float(-6, 2);
      if (!sim.world.isSolid(Math.floor(nx), Math.floor(ny)) && !sim.world.isSolid(Math.floor(nx), Math.floor(ny + 1))) {
        sim.bus.emit('particles', { key: 'teleport', x: e.x, y: e.y, count: 10, color: def.color2 ?? 0x9a7ae8 });
        e.x = nx;
        e.y = ny;
        d.timer = 4;
        break;
      }
    }
  }
  if (d.aggro && d.castCd <= 0 && def.projectile) {
    d.castCd = def.castRate ?? 2.5;
    const ang = Math.atan2(dy, dx);
    spawnProjectile(sim, false, e.x, e.y - e.h * 0.3, ang, def.projectile, def.dmg);
    sim.bus.emit('sound', { key: 'cast', x: e.x, y: e.y });
  }
}

function spitterAI(sim: Sim, e: Entity, d: EnemyData, def: EnemyDef, dx: number, dy: number, dist: number, dt: number): void {
  applyGravity(e, dt);
  e.vx *= 0.85;
  moveEntity(sim.world, e, dt);
  if (d.aggro && dist < 24 && d.castCd <= 0 && def.projectile) {
    d.castCd = def.castRate ?? 2.5;
    // Lob upward to compensate for projectile gravity.
    const ang = Math.atan2(dy - dist * 0.12, dx);
    spawnProjectile(sim, false, e.x, e.y - e.h, ang, def.projectile, def.dmg);
    sim.bus.emit('sound', { key: 'spit', x: e.x, y: e.y });
  }
}

function burrowerAI(sim: Sim, e: Entity, d: EnemyData, speed: number, dx: number, dy: number, dt: number): void {
  const inGround = sim.world.isSolid(Math.floor(e.x), Math.floor(e.y + e.h + 0.2));
  const buried = sim.world.isSolid(Math.floor(e.x), Math.floor(e.y));
  if (buried) {
    // Swim through soil toward the player, slower.
    e.noclip = true;
    const dist = Math.hypot(dx, dy) || 1;
    e.vx = (dx / dist) * speed * 0.6;
    e.vy = (dy / dist) * speed * 0.6;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (d.timer <= 0) {
      sim.bus.emit('particles', { key: 'dust', x: e.x, y: e.y, count: 4, color: 0x8a6a45 });
      d.timer = 0.3;
    }
  } else {
    e.noclip = false;
    walkerAI(sim, e, d, enemyByKey(d.defKey), speed, dx, dt);
    // Re-burrow if the player escapes upward.
    if (d.aggro && dy < -6 && inGround && d.castCd <= 0) {
      e.y += 1.5;
      d.castCd = 3;
    }
  }
}

function swimmerAI(sim: Sim, e: Entity, d: EnemyData, speed: number, dx: number, dy: number, dt: number): void {
  if (e.inLiquid > 0) {
    const dist = Math.hypot(dx, dy) || 1;
    const chase = d.aggro && sim.player.inLiquid > 0;
    e.vx += (((chase ? dx : Math.sin(d.timer + e.id)) / (chase ? dist : 1)) * speed - e.vx) * Math.min(1, dt * 2);
    e.vy += ((chase ? (dy / dist) * speed : Math.sin(d.timer * 2) * 0.5) - e.vy) * Math.min(1, dt * 2);
  } else {
    applyGravity(e, dt);
    e.vx = Math.sin(d.timer * 10) * 2; // flopping
  }
  moveEntity(sim.world, e, dt);
}

function turretAI(sim: Sim, e: Entity, d: EnemyData, def: EnemyDef, dx: number, dy: number, dist: number, dt: number): void {
  applyGravity(e, dt);
  moveEntity(sim.world, e, dt);
  if (dist < 22 && d.castCd <= 0 && def.projectile && lineOfSight(sim, e.x, e.y, sim.player.x, sim.player.y)) {
    d.castCd = def.castRate ?? 2;
    const ang = Math.atan2(dy, dx);
    spawnProjectile(sim, false, e.x, e.y - 0.3, ang, def.projectile, def.dmg);
    sim.bus.emit('sound', { key: 'turret', x: e.x, y: e.y });
  }
}

function minionAI(sim: Sim, e: Entity, d: EnemyData, def: EnemyDef, speed: number, dt: number): void {
  const owner = sim.player;
  const target = nearestHostile(sim, e.x, e.y, 16);
  const tx = target ? target.x : owner.x - owner.facing * 1.5;
  const ty = target ? target.y : owner.y - 1.5;
  const dx = tx - e.x;
  const dy = ty - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  e.vx += ((dx / dist) * speed - e.vx) * Math.min(1, dt * 4);
  e.vy += ((dy / dist) * speed - e.vy) * Math.min(1, dt * 4);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  // Teleport to the player if left behind.
  if (Math.hypot(owner.x - e.x, owner.y - e.y) > 40) {
    e.x = owner.x;
    e.y = owner.y - 2;
  }
  if (target && d.castCd <= 0 && Math.abs(dx) < 1.2 && Math.abs(dy) < 1.2) {
    d.castCd = 0.6;
    applyDamage(sim, target, def.dmg, { knockX: Math.sign(dx) * 3, cause: def.name });
  }
}

function nearestHostile(sim: Sim, x: number, y: number, r: number): Entity | null {
  let best: Entity | null = null;
  let bestD = r * r;
  for (const t of sim.entities) {
    if (t.kind !== 'enemy' || t.dead || (t.data as EnemyData).ownerId) continue;
    const ddx = t.x - x;
    const ddy = t.y - y;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 < bestD) {
      bestD = d2;
      best = t;
    }
  }
  return best;
}

export function lineOfSight(sim: Sim, x0: number, y0: number, x1: number, y1: number): boolean {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (sim.world.isSolid(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t))) return false;
  }
  return true;
}
