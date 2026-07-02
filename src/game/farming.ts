/** Crop growth via random ticks over loaded chunks; sprinklers accelerate. */

import { CHUNK } from '../data/constants';
import { block, blockIdOpt, BLOCK_DEFS } from '../data/blocks';
import type { Sim } from './sim';

const TICKS_PER_SECOND_PER_CHUNK = 14;
const GROWTH_CHANCE = 0.28;

// Precompute crop stage id → next stage id.
const nextStage = new Map<number, number>();
for (let id = 0; id < BLOCK_DEFS.length; id++) {
  const def = BLOCK_DEFS[id];
  if (def.crop && def.crop.stage < def.crop.stages - 1) {
    const nid = blockIdOpt(def.key.replace(/_(\d+)$/, `_${def.crop.stage + 1}`));
    if (nid !== undefined) nextStage.set(id, nid);
  }
}

export function updateFarming(sim: Sim, dt: number): void {
  for (const chunk of sim.world.chunks.values()) {
    // Only tick chunks reasonably near the player.
    if (Math.abs(chunk.cx * CHUNK - sim.player.x) > 96) continue;
    const ticks = Math.max(1, Math.round(TICKS_PER_SECOND_PER_CHUNK * dt * 60) / 60);
    for (let t = 0; t < ticks; t++) {
      if (sim.rng.next() > TICKS_PER_SECOND_PER_CHUNK * dt) continue;
      const i = sim.rng.int(0, chunk.fg.length - 1);
      const id = chunk.fg[i];
      const next = nextStage.get(id);
      if (next === undefined) continue;
      const x = chunk.cx * CHUNK + (i % CHUNK);
      const y = chunk.cy * CHUNK + Math.floor(i / CHUNK);
      // Growth needs light (surface day or lamps) and benefits from sprinklers.
      const lightOk = lightAt(sim, x, y) > 0.25;
      if (!lightOk) continue;
      const boost = nearSprinkler(sim, x, y) ? 2.2 : 1;
      if (sim.rng.next() < GROWTH_CHANCE * boost) {
        sim.world.setTile(x, y, next);
      }
    }
  }
}

function lightAt(sim: Sim, x: number, y: number): number {
  // Cheap: sky-open columns are lit by day; otherwise check for emissive nearby.
  if (y < sim.world.getSkyline(x)) return sim.dayLight();
  for (let dx = -4; dx <= 4; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      const id = sim.world.getTile(x + dx, y + dy);
      if (id !== 0 && (block(id).light ?? 0) >= 8) return 0.6;
    }
  }
  return 0;
}

function nearSprinkler(sim: Sim, x: number, y: number): boolean {
  const sprinklerId = blockIdOpt('sprinkler');
  for (let dx = -8; dx <= 8; dx++) {
    for (let dy = -4; dy <= 4; dy++) {
      if (sim.world.getTile(x + dx, y + dy) === sprinklerId) return true;
    }
  }
  return false;
}
