/** Enemy spawn budgeting: biome/stratum/dimension/night/event-filtered. */

import { ENEMY_DEFS } from '../data/enemies';
import type { EnemyDef } from '../data/types';
import { biomeAt, makeGenContext, type GenContext } from '../world/gen/generator';
import { dimensionByKey } from '../data/dimensions';
import { spawnEnemy } from './ai';
import type { Sim } from './sim';

const SPAWN_INTERVAL = 2.2;
let spawnTimer = 0;
const genCtxCache = new Map<string, GenContext>();

function ctxFor(sim: Sim): GenContext {
  const cacheKey = `${sim.seed}:${sim.dimKey}`;
  let ctx = genCtxCache.get(cacheKey);
  if (!ctx) {
    ctx = makeGenContext(sim.seed, dimensionByKey(sim.dimKey));
    genCtxCache.set(cacheKey, ctx);
  }
  return ctx;
}

export function updateSpawner(sim: Sim, dt: number): void {
  spawnTimer -= dt;
  if (spawnTimer > 0) return;
  spawnTimer = SPAWN_INTERVAL;

  const night = sim.isNight();
  const eventMult = sim.activeEvent === 'crimsonStatic' ? 3 : sim.activeEvent === 'umbralVeil' ? 2 : 1;
  const cap = Math.round((night ? 10 : 6) * eventMult);
  let count = 0;
  for (const e of sim.entities) if (e.kind === 'enemy' && !e.dead && !e.data.ownerId) count++;
  if (count >= cap) return;

  // Pick a candidate location on a ring around the player (off-screen).
  const p = sim.player;
  for (let tries = 0; tries < 6; tries++) {
    const ang = sim.rng.float(0, Math.PI * 2);
    const r = sim.rng.float(22, 34);
    const x = Math.floor(p.x + Math.cos(ang) * r);
    const y = Math.floor(p.y + Math.sin(ang) * r * 0.6);
    if (!sim.world.chunkOf(x, y)) continue;

    const stratum = sim.stratumAt(x, y);
    const biome = biomeAt(ctxFor(sim), x).key;
    const pool = eligible(sim, biome, stratum, night);
    if (pool.length === 0) continue;

    let total = 0;
    for (const [, w] of pool) total += w;
    let roll = sim.rng.float(0, total);
    let picked: EnemyDef | null = null;
    for (const [def, w] of pool) {
      roll -= w;
      if (roll <= 0) {
        picked = def;
        break;
      }
    }
    if (!picked) continue;

    // Placement: flyers/floaters need air; grounders need air + floor.
    const airborne = ['flyer', 'diver', 'floater', 'caster'].includes(picked.archetype);
    const spotFree = !sim.world.isSolid(x, y) && !sim.world.isSolid(x, y - 1);
    if (!spotFree) continue;
    if (!airborne) {
      let floor = false;
      for (let dy = 1; dy <= 4; dy++) {
        if (sim.world.isSolid(x, y + dy)) {
          floor = true;
          break;
        }
      }
      if (!floor) continue;
    }
    spawnEnemy(sim, picked.key, x + 0.5, y + 0.5);
    return;
  }
}

function eligible(sim: Sim, biome: string, stratum: string, night: boolean): [EnemyDef, number][] {
  const out: [EnemyDef, number][] = [];
  for (const def of ENEMY_DEFS) {
    const s = def.spawn;
    if (!s || def.boss) continue;
    // Dimension gate.
    const dims = s.dims ?? ['overworld'];
    if (s.event) {
      if (sim.activeEvent !== s.event) continue;
    } else if (!dims.includes(sim.dimKey)) continue;
    if (s.biomes && !s.biomes.includes(biome)) {
      // Underground-biome enemies use biome tags that ignore surface biome.
      if (!(s.biomes.includes('crystalCavern') && stratum === 'cavern') && !(s.biomes.includes('fungalHollow') && stratum === 'underground')) continue;
    }
    if (s.strata && !s.strata.includes(stratum)) continue;
    if (s.night && !night && !sim.activeEvent) continue;
    if (s.day && night) continue;
    let w = s.weight;
    if (night && !s.night) w *= 0.5; // night favors night creatures
    out.push([def, w]);
  }
  return out;
}
