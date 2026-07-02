/**
 * Portals: a 4×5 ring of dimension-keyed frame blocks (2×3 interior). Clicking
 * a frame validates the ring, ignites the field; standing in the field travels.
 */

import { AIR, blockId } from '../data/blocks';
import type { Sim } from './sim';

/** Interior is 2 wide × 3 tall; ring is one block thick. */
export function tryActivatePortal(sim: Sim, tx: number, ty: number, toDim: string): boolean {
  const frameId = blockId(`frame_${toDim}`);
  // Find a candidate interior origin: scan offsets so any frame block works.
  for (let ox = -3; ox <= 1; ox++) {
    for (let oy = -4; oy <= 1; oy++) {
      const ix = tx + ox;
      const iy = ty + oy;
      if (validRing(sim, ix, iy, frameId) && interiorClear(sim, ix, iy)) {
        ignite(sim, ix, iy, toDim);
        return true;
      }
    }
  }
  sim.bus.emit('banner', { title: 'The frame is incomplete', sub: 'Build a 4×5 ring (2×3 inside)', color: 0x8a8f98 });
  return false;
}

function validRing(sim: Sim, ix: number, iy: number, frameId: number): boolean {
  // ix,iy = top-left of the 2×3 interior. Ring spans (ix-1..ix+2, iy-1..iy+3).
  for (let x = ix - 1; x <= ix + 2; x++) {
    for (let y = iy - 1; y <= iy + 3; y++) {
      const isInterior = x >= ix && x <= ix + 1 && y >= iy && y <= iy + 2;
      if (isInterior) continue;
      if (sim.world.getTile(x, y) !== frameId) return false;
    }
  }
  return true;
}

function interiorClear(sim: Sim, ix: number, iy: number): boolean {
  for (let x = ix; x <= ix + 1; x++) {
    for (let y = iy; y <= iy + 2; y++) {
      const id = sim.world.getTile(x, y);
      if (id !== AIR && id !== blockId('portalCore')) return false;
    }
  }
  return true;
}

function ignite(sim: Sim, ix: number, iy: number, toDim: string): void {
  const core = blockId('portalCore');
  for (let x = ix; x <= ix + 1; x++) {
    for (let y = iy; y <= iy + 2; y++) sim.world.setTile(x, y, core);
  }
  sim.world.portals.set(`${ix},${iy}`, toDim);
  sim.flags.add(`portal.${toDim}`);
  sim.bus.emit('banner', { title: 'The door opens', sub: `${toDim[0].toUpperCase()}${toDim.slice(1)} Stratum attuned`, color: 0x9a7ae8 });
  sim.bus.emit('sound', { key: 'portal', x: ix, y: iy });
  sim.bus.emit('particles', { key: 'portal', x: ix + 1, y: iy + 1.5, count: 30, color: 0x9a7ae8 });
}

/** Called each step: if the player stands in a portal field, request travel. */
export function checkPortalTravel(sim: Sim): string | null {
  const p = sim.player;
  const id = sim.world.getTile(Math.floor(p.x), Math.floor(p.y));
  if (id !== blockId('portalCore')) return null;
  // Which portal? Find the nearest registered core origin.
  let best: string | null = null;
  let bestD = Infinity;
  for (const [key, dim] of sim.world.portals) {
    const [ix, iy] = key.split(',').map(Number);
    const d = (ix - p.x) ** 2 + (iy - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = dim;
    }
  }
  return bestD < 36 ? best : null;
}
