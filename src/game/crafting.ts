/** Crafting: station proximity, natural recipe discovery, trait modifiers. */

import { RECIPES } from '../data/recipes';
import { block } from '../data/blocks';
import { itemByKey } from '../data/items';
import type { RecipeDef, StationKind } from '../data/types';
import { spawnDrop } from './combat';
import type { PlayerData, Sim } from './sim';

const STATION_RANGE = 8;

export function stationsNearby(sim: Sim): Set<StationKind> {
  const out = new Set<StationKind>();
  const px = Math.floor(sim.player.x);
  const py = Math.floor(sim.player.y);
  for (let dx = -STATION_RANGE; dx <= STATION_RANGE; dx++) {
    for (let dy = -STATION_RANGE; dy <= STATION_RANGE; dy++) {
      const id = sim.world.getTile(px + dx, py + dy);
      if (id === 0) continue;
      const st = block(id).station;
      if (st) out.add(st);
    }
  }
  return out;
}

export interface RecipeView {
  recipe: RecipeDef;
  canCraft: boolean;
  known: boolean;
  stationOk: boolean;
}

export function recipeList(sim: Sim, stations: Set<StationKind>): RecipeView[] {
  const pd = sim.player.data as PlayerData;
  const research = sim.bonus('research') > 1; // Scholar: sees recipes one step early
  const out: RecipeView[] = [];
  for (const r of RECIPES) {
    if (r.flag && !sim.flags.has(r.flag)) continue;
    const seenCount = r.ins.filter(([k]) => pd.seenItems.has(k)).length;
    const known =
      pd.seenItems.has(r.out) ||
      seenCount === r.ins.length ||
      (research && seenCount >= r.ins.length - 1 && seenCount > 0);
    if (!known) continue;
    const stationOk = !r.station || stations.has(r.station);
    const canCraft = stationOk && pd.inventory.has(r.ins);
    out.push({ recipe: r, canCraft, known, stationOk });
  }
  // Craftable first, then by output name.
  out.sort((a, b) => Number(b.canCraft) - Number(a.canCraft) || itemByKey(a.recipe.out).name.localeCompare(itemByKey(b.recipe.out).name));
  return out;
}

export function craft(sim: Sim, recipe: RecipeDef): boolean {
  const pd = sim.player.data as PlayerData;
  if (recipe.flag && !sim.flags.has(recipe.flag)) return false;
  const stations = stationsNearby(sim);
  if (recipe.station && !stations.has(recipe.station)) return false;

  // Scholar wastes less; Engineer pays less for electronics.
  let refund = 0;
  const waste = sim.bonus('craftWaste');
  if (waste < 1) refund = 1 - waste;
  const elec = sim.bonus('electronicsCost');
  if (elec < 1 && recipe.ins.some(([k]) => k === 'circuit' || k === 'gearScrap')) refund = Math.max(refund, 1 - elec);

  if (!pd.inventory.consume(recipe.ins, refund, () => sim.rng.next())) return false;
  const left = pd.inventory.add(recipe.out, recipe.count);
  if (left > 0) {
    // Inventory full: spill the remainder at the player's feet.
    spawnDrop(sim, sim.player.x, sim.player.y, recipe.out, left);
  }
  pd.seenItems.add(recipe.out);
  sim.bus.emit('sound', { key: 'craft' });
  sim.bus.emit('crafted', { itemKey: recipe.out, count: recipe.count });
  return true;
}
