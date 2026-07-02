/**
 * Machines: generators power extractors within radius; extractors slowly pull
 * ore from adjacent veins (consuming them after several yields). Engineer
 * trait speeds everything up.
 */

import { CHUNK } from '../data/constants';
import { block, blockId } from '../data/blocks';
import { spawnDrop } from './combat';
import type { Sim } from './sim';

const SCAN_INTERVAL = 2;
const EXTRACT_INTERVAL = 30;
const POWER_RADIUS = 24;

interface MachineState {
  scanT: number;
  generators: [number, number][];
  extractors: Map<string, number>; // "x,y" → progress seconds
}

const state: MachineState = { scanT: 0, generators: [], extractors: new Map() };

export function resetMachines(): void {
  state.scanT = 0;
  state.generators = [];
  state.extractors.clear();
}

export function updateMachines(sim: Sim, dt: number): void {
  state.scanT -= dt;
  if (state.scanT <= 0) {
    state.scanT = SCAN_INTERVAL;
    scan(sim);
  }
  const speed = sim.bonus('machineSpeed');
  for (const [key, progress] of state.extractors) {
    const [x, y] = key.split(',').map(Number);
    if (!powered(x, y)) continue;
    const next = progress + dt * speed;
    if (next >= EXTRACT_INTERVAL) {
      state.extractors.set(key, 0);
      extract(sim, x, y);
    } else {
      state.extractors.set(key, next);
    }
  }
}

function scan(sim: Sim): void {
  const genId = blockId('generator');
  const extId = blockId('extractor');
  state.generators = [];
  const live = new Set<string>();
  for (const chunk of sim.world.chunks.values()) {
    for (let i = 0; i < chunk.fg.length; i++) {
      const id = chunk.fg[i];
      if (id !== genId && id !== extId) continue;
      const x = chunk.cx * CHUNK + (i % CHUNK);
      const y = chunk.cy * CHUNK + Math.floor(i / CHUNK);
      if (id === genId) state.generators.push([x, y]);
      else {
        const key = `${x},${y}`;
        live.add(key);
        if (!state.extractors.has(key)) state.extractors.set(key, 0);
      }
    }
  }
  for (const key of state.extractors.keys()) {
    if (!live.has(key)) state.extractors.delete(key);
  }
}

function powered(x: number, y: number): boolean {
  for (const [gx, gy] of state.generators) {
    const dx = gx - x;
    const dy = gy - y;
    if (dx * dx + dy * dy <= POWER_RADIUS * POWER_RADIUS) return true;
  }
  return false;
}

function extract(sim: Sim, x: number, y: number): void {
  // Find an ore vein in a 5×5 area beneath/around the extractor.
  for (let dy = 0; dy <= 4; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const tx = x + dx;
      const ty = y + 1 + dy;
      const id = sim.world.getTile(tx, ty);
      if (id === 0) continue;
      const def = block(id);
      if (def.style === 'ore') {
        spawnDrop(sim, x + 0.5, y - 0.5, def.key, 1);
        // Veins deplete: each yield has a chance to consume the block.
        if (sim.rng.chance(0.34)) sim.world.setTile(tx, ty, blockId('stone'));
        sim.bus.emit('sound', { key: 'extract', x, y });
        sim.bus.emit('particles', { key: 'mine', x: x + 0.5, y: y + 0.5, count: 3, color: def.color2 ?? def.color });
        return;
      }
    }
  }
}
