/**
 * Cellular liquid simulation over the world's active set: flow down, then
 * equalize sideways; settled cells go to sleep. Water + lava interactions
 * produce stone/obsidian. Budgeted per step so oceans can't stall the frame.
 */

import { blockId, block } from '../data/blocks';
import { LIQ_LAVA, LIQ_NONE, LIQ_WATER, LIQ_MAX } from './chunk';
import type { World } from './world';

const STONE = () => blockId('stone');
const OBSIDIAN = () => blockId('obsidian');

export function stepLiquids(world: World, budget = 320): void {
  if (world.activeLiquid.size === 0) return;
  const cells = [...world.activeLiquid];
  // Process bottom-up-ish is unnecessary; random order settles fine.
  const n = Math.min(cells.length, budget);
  for (let k = 0; k < n; k++) {
    const key = cells[k];
    world.activeLiquid.delete(key);
    const comma = key.indexOf(',');
    const x = +key.slice(0, comma);
    const y = +key.slice(comma + 1);
    const { type, amount } = world.getLiquid(x, y);
    if (amount <= 0) continue;
    if (!world.chunkOf(x, y)) continue; // unloaded — re-activates on chunk load

    // Fragile blocks break under liquid.
    const here = world.getTile(x, y);
    if (here !== 0 && block(here).fragile) world.setTile(x, y, 0);

    // 1. Flow down.
    if (canFlowInto(world, x, y + 1)) {
      const below = world.getLiquid(x, y + 1);
      if (below.type !== LIQ_NONE && below.type !== type && below.amount > 0) {
        interact(world, x, y, x, y + 1, type, below.type);
        continue;
      }
      const space = LIQ_MAX - below.amount;
      if (space > 0) {
        const move = Math.min(space, amount);
        world.setLiquid(x, y + 1, type, below.amount + move);
        world.setLiquid(x, y, type, amount - move);
        continue;
      }
    }

    // 2. Equalize sideways (randomless: try both, split).
    let remaining = world.getLiquid(x, y).amount;
    if (remaining <= 1) continue;
    for (const dx of [-1, 1]) {
      if (remaining <= 1) break;
      const nx = x + dx;
      if (!canFlowInto(world, nx, y)) continue;
      const side = world.getLiquid(nx, y);
      if (side.type !== LIQ_NONE && side.type !== type && side.amount > 0) {
        interact(world, x, y, nx, y, type, side.type);
        remaining = world.getLiquid(x, y).amount;
        continue;
      }
      if (side.amount < remaining - 1) {
        const move = Math.max(1, Math.floor((remaining - side.amount) / 2) - (side.amount === 0 ? 0 : 0));
        const actual = Math.min(move, remaining - 1);
        world.setLiquid(nx, y, type, side.amount + actual);
        remaining -= actual;
        world.setLiquid(x, y, type, remaining);
      }
    }
  }
}

function canFlowInto(world: World, x: number, y: number): boolean {
  if (!world.chunkOf(x, y)) return false;
  const id = world.getTile(x, y);
  if (id === 0) return true;
  const def = block(id);
  return !def.solid && !def.platform;
}

/** Water + lava: the hotter side wins the geology. */
function interact(world: World, x1: number, y1: number, x2: number, y2: number, t1: number, t2: number): void {
  if ((t1 === LIQ_WATER && t2 === LIQ_LAVA) || (t1 === LIQ_LAVA && t2 === LIQ_WATER)) {
    const [lx, ly] = t1 === LIQ_LAVA ? [x1, y1] : [x2, y2];
    const wasFull = world.getLiquid(lx, ly).amount >= LIQ_MAX;
    world.setLiquid(x1, y1, LIQ_NONE, 0);
    world.setLiquid(x2, y2, LIQ_NONE, 0);
    world.setTile(lx, ly, wasFull ? OBSIDIAN() : STONE());
  }
}
