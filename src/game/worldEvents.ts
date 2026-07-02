/** World events: rolled at dawn/dusk, applied as spawn/light/weather modifiers. */

import { blockId } from '../data/blocks';
import { biomeByKey } from '../data/dimensions';
import { spawnEnemy } from './ai';
import { applyDamage } from './combat';
import { spawnProjectile } from './projectiles';
import type { Sim } from './sim';

export interface WorldEventState {
  key: string | null;
  endsAt: number; // absolute time in days
  meteorTimer: number;
  lightningTimer: number;
  quakeTimer: number;
}

export const EVENT_NAMES: Record<string, string> = {
  meteorShower: 'Meteor Shower',
  crimsonStatic: 'Crimson Static',
  umbralVeil: 'The Umbral Veil',
  earthquake: 'Earthquake',
  incursion: 'Dimensional Incursion',
  colossus: 'A Wandering Colossus',
};

/** Roll at dawn (day) and dusk (night) transitions. */
export function rollEvent(sim: Sim, ev: WorldEventState, nightStarting: boolean): void {
  if (ev.key) return;
  const r = sim.rng.next();
  const post = sim.flags.has('boss.warden');
  const anyPortal = [...sim.flags].some((f) => f.startsWith('portal.'));
  if (nightStarting) {
    if (r < 0.12) start(sim, ev, 'meteorShower', 0.5);
    else if (post && r < 0.22) start(sim, ev, 'crimsonStatic', 0.5);
    else if (r < 0.28) start(sim, ev, 'earthquake', 0.08);
    else if (anyPortal && r < 0.38) start(sim, ev, 'incursion', 0.3);
  } else {
    if (post && r < 0.08) start(sim, ev, 'umbralVeil', 0.3);
    else if (r < 0.12) start(sim, ev, 'earthquake', 0.08);
    else if (r < 0.15) start(sim, ev, 'colossus', 0.4);
  }
}

function start(sim: Sim, ev: WorldEventState, key: string, durationDays: number): void {
  ev.key = key;
  ev.endsAt = sim.day + sim.timeOfDay + durationDays;
  sim.bus.emit('eventStarted', { key, name: EVENT_NAMES[key] });
  sim.bus.emit('banner', { title: EVENT_NAMES[key], sub: eventSub(key), color: eventColor(key) });
  sim.bus.emit('musicCue', { key: key === 'crimsonStatic' || key === 'umbralVeil' ? 'danger' : 'event' });
  if (key === 'colossus') {
    const pick = sim.isNight() ? 'elder_glacierGolem' : 'elder_nightStalker';
    spawnEnemy(sim, pick, sim.player.x + 30, sim.surfaceAt(Math.floor(sim.player.x + 30)) - 3);
  }
}

function eventSub(key: string): string {
  switch (key) {
    case 'meteorShower': return 'Skyfall — mind your roof';
    case 'crimsonStatic': return 'The moon crackles. They come in numbers.';
    case 'umbralVeil': return 'The sun forgets. Elite creatures walk by day.';
    case 'earthquake': return 'The lattice shudders';
    case 'incursion': return 'Rifts tear open nearby';
    case 'colossus': return 'Something vast crosses the surface';
    default: return '';
  }
}

function eventColor(key: string): number {
  switch (key) {
    case 'crimsonStatic': return 0xd94f4f;
    case 'umbralVeil': return 0x8a5fb0;
    case 'meteorShower': return 0xff8a50;
    default: return 0xe8c84a;
  }
}

export function updateEvents(sim: Sim, ev: WorldEventState, dt: number): void {
  if (!ev.key) return;
  const now = sim.day + sim.timeOfDay;
  if (now >= ev.endsAt) {
    sim.bus.emit('eventEnded', { key: ev.key });
    sim.bus.emit('banner', { title: `${EVENT_NAMES[ev.key]} has passed`, color: 0x8a8f98 });
    ev.key = null;
    return;
  }
  const p = sim.player;
  switch (ev.key) {
    case 'meteorShower': {
      ev.meteorTimer -= dt;
      if (ev.meteorTimer <= 0) {
        ev.meteorTimer = sim.rng.float(2, 6);
        const x = p.x + sim.rng.float(-30, 30);
        const meteor = spawnProjectile(
          sim,
          false,
          x,
          Math.max(4, p.y - 30),
          Math.PI / 2 + sim.rng.float(-0.3, 0.3),
          { look: 'flame', speed: 22, gravity: 0.2, explode: 3, color: 0xff8a50 },
          20,
        );
        meteor.data.meteor = true;
        sim.bus.emit('sound', { key: 'meteor', x, y: p.y - 20 });
      }
      break;
    }
    case 'earthquake': {
      ev.quakeTimer -= dt;
      if (ev.quakeTimer <= 0) {
        ev.quakeTimer = sim.rng.float(0.8, 2);
        sim.bus.emit('screenShake', { amount: sim.rng.float(2, 5) });
        sim.bus.emit('particles', { key: 'dust', x: p.x + sim.rng.float(-10, 10), y: p.y + sim.rng.float(-6, 6), count: 6, color: 0x8a8f98 });
        sim.bus.emit('sound', { key: 'rumble', x: p.x, y: p.y });
      }
      break;
    }
    case 'incursion': {
      // Handled by the spawner (event pool) — plus occasional rift flash.
      ev.meteorTimer -= dt;
      if (ev.meteorTimer <= 0) {
        ev.meteorTimer = sim.rng.float(4, 9);
        sim.bus.emit('particles', { key: 'portal', x: p.x + sim.rng.float(-20, 20), y: p.y - sim.rng.float(2, 10), count: 12, color: 0x9a7ae8 });
      }
      break;
    }
    default:
      break;
  }
}

/** Storm lightning (weather system): occasional strikes near the player. */
export function updateStorm(sim: Sim, ev: WorldEventState, dt: number): void {
  if (sim.weather !== 'storm') return;
  ev.lightningTimer -= dt;
  if (ev.lightningTimer > 0) return;
  ev.lightningTimer = sim.rng.float(3, 9);
  const x = Math.floor(sim.player.x + sim.rng.float(-24, 24));
  const y = sim.surfaceAt(x);
  sim.bus.emit('particles', { key: 'lightning', x: x + 0.5, y: y - 8, count: 1 });
  sim.bus.emit('screenShake', { amount: 2 });
  sim.bus.emit('sound', { key: 'thunder', x, y });
  const p = sim.player;
  if (Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 6) {
    applyDamage(sim, p, 24, { dot: true, cause: 'lightning' });
  }
}

/** Meteor impacts leave meteoric ore where they explode. */
export function onMeteorImpact(sim: Sim, x: number, y: number): void {
  const ore = blockId('meteoricOre');
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (Math.abs(dx) + Math.abs(dy) > 1) continue;
      const tx = Math.floor(x) + dx;
      const ty = Math.floor(y) + dy;
      if (sim.world.isSolid(tx, ty) && sim.rng.chance(0.7)) sim.world.setTile(tx, ty, ore);
    }
  }
}

/** Weather rolls per in-game morning, biome-aware. */
export function rollWeather(sim: Sim): string {
  const biome = biomeByKey(currentBiomeKey(sim));
  const options = ['clear', 'clear', 'clear', ...biome.weather] as string[];
  const w = options[sim.rng.int(0, options.length - 1)];
  // Rain upgrades to storm sometimes.
  if (w === 'rain' && sim.rng.chance(0.3)) return 'storm';
  return w;
}

import { biomeAt, makeGenContext } from '../world/gen/generator';
import { dimensionByKey } from '../data/dimensions';

const ctxCache = new Map<string, ReturnType<typeof makeGenContext>>();
export function currentBiomeKey(sim: Sim): string {
  const cacheKey = `${sim.seed}:${sim.dimKey}`;
  let ctx = ctxCache.get(cacheKey);
  if (!ctx) {
    ctx = makeGenContext(sim.seed, dimensionByKey(sim.dimKey));
    ctxCache.set(cacheKey, ctx);
  }
  return biomeAt(ctx, Math.floor(sim.player.x)).key;
}
