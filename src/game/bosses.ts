/**
 * Boss framework: data-driven multi-phase attack scripts built from shared
 * primitives (volley, radial, dash, summon, slam, rain). Eight encounters
 * share this one engine — per-boss cost is a script, not code.
 */

import { enemyByKey } from '../data/enemies';
import type { Entity } from './entities';
import { applyDamage, statusMult } from './combat';
import { applyGravity, moveEntity } from './physics';
import { spawnProjectile } from './projectiles';
import { spawnEnemy } from './ai';
import type { Sim } from './sim';

type AttackKind = 'volley' | 'radial' | 'dash' | 'summon' | 'slam' | 'rain' | 'blink';

interface Attack {
  kind: AttackKind;
  cd: number;
  n?: number; // projectiles / minions
  spread?: number; // radians
  summonKey?: string;
  speedMult?: number;
}

interface Phase {
  hpPct: number; // phase active while hp/maxHp <= hpPct
  speedMult: number;
  attacks: Attack[];
}

const SCRIPTS: Record<string, Phase[]> = {
  bossWarden: [
    { hpPct: 1, speedMult: 1, attacks: [{ kind: 'volley', cd: 2.6, n: 3, spread: 0.5 }, { kind: 'slam', cd: 4.5 }] },
    { hpPct: 0.5, speedMult: 1.5, attacks: [{ kind: 'volley', cd: 1.8, n: 5, spread: 0.8 }, { kind: 'slam', cd: 3.2 }, { kind: 'summon', cd: 9, n: 2, summonKey: 'wardenShardling' }] },
  ],
  bossChronophage: [
    { hpPct: 1, speedMult: 1, attacks: [{ kind: 'dash', cd: 3.4, speedMult: 2.4 }, { kind: 'volley', cd: 2.2, n: 3, spread: 0.4 }] },
    { hpPct: 0.5, speedMult: 1.3, attacks: [{ kind: 'dash', cd: 2.4, speedMult: 2.8 }, { kind: 'radial', cd: 4.2, n: 10 }, { kind: 'rain', cd: 5, n: 6 }] },
  ],
  bossNull: [
    { hpPct: 1, speedMult: 1, attacks: [{ kind: 'blink', cd: 4 }, { kind: 'volley', cd: 1.8, n: 4, spread: 0.6 }] },
    { hpPct: 0.6, speedMult: 1.2, attacks: [{ kind: 'blink', cd: 3 }, { kind: 'radial', cd: 3.6, n: 12 }, { kind: 'summon', cd: 10, n: 2, summonKey: 'riftSpawn' }] },
    { hpPct: 0.25, speedMult: 1.5, attacks: [{ kind: 'blink', cd: 2.2 }, { kind: 'radial', cd: 2.2, n: 16 }, { kind: 'rain', cd: 4, n: 8 }] },
  ],
  bossRefractor: [
    { hpPct: 1, speedMult: 1, attacks: [{ kind: 'volley', cd: 2, n: 4, spread: 0.5 }, { kind: 'blink', cd: 5 }] },
    { hpPct: 0.5, speedMult: 1.3, attacks: [{ kind: 'radial', cd: 3, n: 10 }, { kind: 'volley', cd: 1.6, n: 5, spread: 0.9 }] },
  ],
  bossBorea: [
    { hpPct: 1, speedMult: 1, attacks: [{ kind: 'volley', cd: 2.4, n: 3, spread: 0.4 }, { kind: 'slam', cd: 4 }] },
    { hpPct: 0.5, speedMult: 1.4, attacks: [{ kind: 'rain', cd: 3.6, n: 7 }, { kind: 'slam', cd: 3 }, { kind: 'summon', cd: 11, n: 1, summonKey: 'frostWisp' }] },
  ],
  bossPyraxis: [
    { hpPct: 1, speedMult: 1, attacks: [{ kind: 'volley', cd: 2, n: 4, spread: 0.7 }, { kind: 'rain', cd: 4.5, n: 5 }] },
    { hpPct: 0.5, speedMult: 1.3, attacks: [{ kind: 'radial', cd: 3.4, n: 12 }, { kind: 'rain', cd: 3, n: 8 }, { kind: 'summon', cd: 10, n: 1, summonKey: 'magmaFloater' }] },
  ],
  bossFabrik: [
    { hpPct: 1, speedMult: 1, attacks: [{ kind: 'volley', cd: 1.8, n: 3, spread: 0.3 }, { kind: 'summon', cd: 9, n: 1, summonKey: 'gearDrone' }] },
    { hpPct: 0.5, speedMult: 1.2, attacks: [{ kind: 'radial', cd: 3.2, n: 10 }, { kind: 'volley', cd: 1.4, n: 5, spread: 0.6 }, { kind: 'summon', cd: 8, n: 2, summonKey: 'gearDrone' }] },
  ],
  bossZephyr: [
    { hpPct: 1, speedMult: 1, attacks: [{ kind: 'dash', cd: 3, speedMult: 2.2 }, { kind: 'volley', cd: 2.2, n: 3, spread: 0.5 }] },
    { hpPct: 0.5, speedMult: 1.4, attacks: [{ kind: 'dash', cd: 2.2, speedMult: 2.6 }, { kind: 'radial', cd: 3.8, n: 10 }, { kind: 'summon', cd: 10, n: 2, summonKey: 'zephyrDiver' }] },
  ],
};

interface BossState {
  cds: number[];
  dashT: number;
  dashVx: number;
  dashVy: number;
}

export function updateBosses(sim: Sim, dt: number): void {
  const player = sim.player;
  for (const e of sim.entities) {
    if (e.kind !== 'enemy' || e.dead || !e.data.defKey?.startsWith('boss')) continue;
    const def = enemyByKey(e.data.defKey);
    const script = SCRIPTS[def.key];
    if (!script) continue;
    const st: BossState = (e.data.boss ??= { cds: [], dashT: 0, dashVx: 0, dashVy: 0 });

    // Phase selection.
    const pct = e.hp / e.maxHp;
    let phase = script[0];
    for (const ph of script) if (pct <= ph.hpPct) phase = ph;

    sim.bus.emit('bossBar', { name: def.name, hp: Math.max(0, e.hp), maxHp: e.maxHp });

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    e.facing = dx >= 0 ? 1 : -1;
    const speed = def.speed * phase.speedMult * statusMult(e, 'speedMult');

    // Movement by body plan.
    if (st.dashT > 0) {
      st.dashT -= dt;
      e.vx = st.dashVx;
      e.vy = st.dashVy;
      e.noclip = true;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    } else if (def.archetype === 'walker') {
      e.noclip = false;
      e.vx = Math.sign(dx) * speed;
      applyGravity(e, dt);
      e.data.canStep = true;
      const res = moveEntity(sim.world, e, dt);
      if (res.hitWall && e.onGround) e.vy = -14;
    } else {
      // Flyer/floater: hover around the player.
      e.noclip = true;
      const hoverY = def.archetype === 'flyer' ? -7 : -4;
      e.vx += ((dx / dist) * speed - e.vx) * Math.min(1, dt * 2);
      e.vy += (((dy + -hoverY * -1) / dist) * speed + Math.sin(sim.timeOfDay * 400 + e.id) * 0.5 - e.vy) * Math.min(1, dt * 2);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }

    // Contact damage.
    if (player.iframes <= 0 && Math.abs(dx) < e.w + player.w && Math.abs(dy) < e.h + player.h) {
      applyDamage(sim, player, def.dmg, { knockX: Math.sign(-dx) * -8 * Math.sign(dx || 1), knockY: -6, cause: def.name });
    }

    // Attacks.
    phase.attacks.forEach((atk, i) => {
      st.cds[i] = (st.cds[i] ?? atk.cd * (0.4 + 0.2 * i)) - dt;
      if (st.cds[i] > 0) return;
      st.cds[i] = atk.cd;
      runAttack(sim, e, def.key, atk, dx, dy, dist);
    });

    // Despawn if the player flees far or dies for too long.
    if (dist > 110) {
      e.dead = true;
      sim.bus.emit('bossBar', null);
      sim.bus.emit('banner', { title: `${def.name} loses interest`, color: 0x8a8f98 });
    }
  }
}

function runAttack(sim: Sim, e: Entity, key: string, atk: Attack, dx: number, dy: number, dist: number): void {
  const def = enemyByKey(key);
  const proj = def.projectile;
  const st = e.data.boss as BossState;
  switch (atk.kind) {
    case 'volley': {
      if (!proj) return;
      const base = Math.atan2(dy, dx);
      const n = atk.n ?? 3;
      const spread = atk.spread ?? 0.5;
      for (let i = 0; i < n; i++) {
        const a = base + (n > 1 ? -spread / 2 + (spread * i) / (n - 1) : 0);
        spawnProjectile(sim, false, e.x, e.y, a, proj, def.dmg * 0.8);
      }
      sim.bus.emit('sound', { key: 'cast', x: e.x, y: e.y });
      break;
    }
    case 'radial': {
      if (!proj) return;
      const n = atk.n ?? 10;
      for (let i = 0; i < n; i++) {
        spawnProjectile(sim, false, e.x, e.y, (Math.PI * 2 * i) / n, { ...proj, homing: 0 }, def.dmg * 0.7);
      }
      sim.bus.emit('sound', { key: 'radial', x: e.x, y: e.y });
      break;
    }
    case 'dash': {
      const mult = atk.speedMult ?? 2.4;
      st.dashT = Math.min(1, dist / (def.speed * mult));
      st.dashVx = (dx / dist) * def.speed * mult;
      st.dashVy = (dy / dist) * def.speed * mult;
      sim.bus.emit('sound', { key: 'dash', x: e.x, y: e.y });
      break;
    }
    case 'blink': {
      sim.bus.emit('particles', { key: 'teleport', x: e.x, y: e.y, count: 16, color: def.color2 ?? 0x9a7ae8 });
      const side = sim.rng.chance(0.5) ? 1 : -1;
      e.x = sim.player.x + side * sim.rng.float(8, 14);
      e.y = sim.player.y - sim.rng.float(4, 9);
      sim.bus.emit('sound', { key: 'teleport', x: e.x, y: e.y });
      break;
    }
    case 'summon': {
      const n = atk.n ?? 1;
      for (let i = 0; i < n; i++) {
        if (atk.summonKey) spawnEnemy(sim, atk.summonKey, e.x + sim.rng.float(-4, 4), e.y - sim.rng.float(0, 3));
      }
      sim.bus.emit('sound', { key: 'summon', x: e.x, y: e.y });
      break;
    }
    case 'slam': {
      if (!e.onGround && def.archetype === 'walker') return;
      sim.bus.emit('screenShake', { amount: 6 });
      sim.bus.emit('particles', { key: 'dust', x: e.x, y: e.y + e.h, count: 16, color: 0x8a8f98 });
      sim.bus.emit('sound', { key: 'slam', x: e.x, y: e.y });
      // Ground shock: hits the player if grounded and near.
      const p = sim.player;
      if (p.onGround && Math.abs(p.x - e.x) < 12 && Math.abs(p.y - e.y) < 6) {
        applyDamage(sim, p, def.dmg * 0.9, { knockY: -10, cause: def.name });
      }
      if (proj) {
        // Shrapnel arcs.
        for (let i = 0; i < 4; i++) {
          spawnProjectile(sim, false, e.x, e.y - e.h, -Math.PI / 2 + sim.rng.float(-0.7, 0.7), { ...proj, gravity: 0.8 }, def.dmg * 0.6);
        }
      }
      break;
    }
    case 'rain': {
      if (!proj) return;
      const n = atk.n ?? 6;
      const p = sim.player;
      for (let i = 0; i < n; i++) {
        const x = p.x + sim.rng.float(-10, 10);
        spawnProjectile(sim, false, x, p.y - 14, Math.PI / 2 + sim.rng.float(-0.15, 0.15), { ...proj, homing: 0, gravity: 0.4 }, def.dmg * 0.7);
      }
      sim.bus.emit('sound', { key: 'rainAtk', x: p.x, y: p.y });
      break;
    }
  }
}

/** Dimension bosses stir naturally after enough local kills. */
export function checkDimensionBossTrigger(sim: Sim): void {
  const dimBoss = sim.world.dim.bossKey;
  if (!dimBoss || sim.dimKey === 'overworld') return;
  if (sim.flags.has(`boss.${dimBoss.replace(/^boss/, '').toLowerCase()}.seen`)) return;
  if (sim.entities.some((e) => e.kind === 'enemy' && !e.dead && e.data.defKey?.startsWith('boss'))) return;
  let kills = 0;
  for (const [key, n] of sim.killCounter) {
    const def = enemyByKey(key);
    if (def.spawn?.dims?.includes(sim.dimKey)) kills += n;
  }
  if (kills >= 15) {
    sim.flags.add(`boss.${dimBoss.replace(/^boss/, '').toLowerCase()}.seen`);
    spawnEnemy(sim, dimBoss, sim.player.x + (sim.rng.chance(0.5) ? 16 : -16), sim.player.y - 8);
    sim.bus.emit('banner', { title: 'The stratum stirs…', color: 0xd94f4f });
  }
}
