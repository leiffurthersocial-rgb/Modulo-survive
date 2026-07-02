/**
 * NPCs: arrival gating, housing validation (enclosed + door + light + table +
 * chair), happiness → prices, daily schedules and dialogue selection.
 */

import { NPC_DEFS, npcByKey } from '../data/npcs';
import { block } from '../data/blocks';
import { makeEntity, type Entity } from './entities';
import { applyGravity, moveEntity } from './physics';
import { currentBiomeKey } from './worldEvents';
import type { Sim } from './sim';

export interface NPCData {
  defKey: string;
  homeX: number;
  homeY: number;
  hasHome: boolean;
  happiness: number; // 0.6 (grim) … 1.4 (thriving); prices divide by it
  wanderDir: number;
  wanderT: number;
  canStep: boolean;
}

const HOUSE_MAX_AREA = 320;

/** Flood-fill housing check from an interior air tile. */
export function isValidHouse(sim: Sim, startX: number, startY: number): { ok: boolean; door: boolean; light: boolean; table: boolean; chair: boolean } {
  const seen = new Set<string>();
  const stack: [number, number][] = [[startX, startY]];
  let door = false;
  let light = false;
  let table = false;
  let chair = false;
  let open = false;
  let cells = 0;
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const id = sim.world.getTile(x, y);
    const def = block(id);
    if (def.solid) continue; // wall of the room
    if (def.furniture === 'door') {
      door = true;
      continue; // doors bound the room
    }
    cells++;
    if (cells > HOUSE_MAX_AREA) {
      open = true;
      break;
    }
    if ((def.light ?? 0) >= 8) light = true;
    if (def.furniture === 'table' || def.furniture === 'station') table = true;
    if (def.furniture === 'chair' || def.furniture === 'bed') chair = true;
    // A room also needs background walls to count as sheltered.
    if (sim.world.getWall(x, y) === 0 && !def.solid && id === 0) {
      // Allow a little open ceiling but mostly walled.
      if (sim.rng.next() < 0.02) open = true;
    }
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const ok = !open && cells >= 12 && door && light && table && chair;
  return { ok, door, light, table, chair };
}

/** Nightly: NPCs whose flags are satisfied arrive if an empty house exists near spawn. */
export function updateNPCArrivals(sim: Sim): void {
  if (sim.dimKey !== 'overworld') return;
  const present = new Set(sim.entities.filter((e) => e.kind === 'npc' && !e.dead).map((e) => e.data.defKey as string));
  for (const def of NPC_DEFS) {
    if (present.has(def.key)) continue;
    if (def.arrivesWhen && !sim.flags.has(def.arrivesWhen)) continue;
    if (sim.flags.has(`npc.${def.key}.dead`)) continue;
    // First NPC (Ordo) arrives once the player has built a bit; others follow.
    if (def.key === 'ordo' && (sim.player.data.placedCount ?? 0) < 20) continue;
    // Search for a valid house near the player's respawn point.
    const cx = Math.floor(sim.player.data.respawnX ?? sim.player.x);
    const cy = Math.floor(sim.player.data.respawnY ?? sim.player.y);
    outer: for (let dx = -40; dx <= 40; dx += 4) {
      for (let dy = -20; dy <= 20; dy += 3) {
        const x = cx + dx;
        const y = cy + dy;
        if (sim.world.getTile(x, y) !== 0) continue;
        const res = isValidHouse(sim, x, y);
        if (res.ok && !occupied(sim, x, y)) {
          spawnNPC(sim, def.key, x + 0.5, y + 0.5);
          sim.bus.emit('banner', { title: `${def.name} ${def.title} has arrived`, color: 0x58b04c });
          break outer;
        }
      }
    }
    break; // one arrival per night at most
  }
}

function occupied(sim: Sim, x: number, y: number): boolean {
  return sim.entities.some((e) => e.kind === 'npc' && !e.dead && Math.abs(e.data.homeX - x) < 10 && Math.abs(e.data.homeY - y) < 8);
}

export function spawnNPC(sim: Sim, key: string, x: number, y: number): Entity {
  const e = makeEntity('npc', x, y, 0.38, 0.85);
  e.hp = 250;
  e.maxHp = 250;
  const data: NPCData = {
    defKey: key,
    homeX: Math.floor(x),
    homeY: Math.floor(y),
    hasHome: true,
    happiness: 1,
    wanderDir: 1,
    wanderT: 0,
    canStep: true,
  };
  e.data = data;
  sim.entities.push(e);
  return e;
}

export function updateNPCs(sim: Sim, dt: number): void {
  const dangerous = sim.activeEvent === 'crimsonStatic' || sim.activeEvent === 'umbralVeil';
  for (const e of sim.entities) {
    if (e.kind !== 'npc' || e.dead) continue;
    const d = e.data as NPCData;
    if (e.hp <= 0) {
      e.dead = true;
      sim.flags.add(`npc.${d.defKey}.dead`);
      sim.bus.emit('banner', { title: `${npcByKey(d.defKey).name} has fallen`, color: 0xd94f4f });
      continue;
    }
    // Happiness follows biome preference (checked lazily).
    const biome = currentBiomeKey(sim);
    const def = npcByKey(d.defKey);
    d.happiness = def.biomeLikes.includes(biome) ? 1.15 : def.biomeDislikes.includes(biome) ? 0.85 : 1;

    const goHome = sim.isNight() || dangerous;
    d.wanderT -= dt;
    if (goHome) {
      const dx = d.homeX - e.x;
      e.vx = Math.abs(dx) > 1.5 ? Math.sign(dx) * 2.4 : 0;
    } else {
      if (d.wanderT <= 0) {
        d.wanderT = sim.rng.float(2, 6);
        d.wanderDir = sim.rng.pick([-1, 0, 0, 1]);
      }
      // Stay within ~18 tiles of home.
      if (Math.abs(e.x - d.homeX) > 18) d.wanderDir = Math.sign(d.homeX - e.x);
      e.vx = d.wanderDir * 1.8;
    }
    if (e.vx !== 0) e.facing = e.vx > 0 ? 1 : -1;
    applyGravity(e, dt);
    const res = moveEntity(sim.world, e, dt);
    if (res.hitWall && e.onGround) e.vy = -9;
  }
}

/** Dialogue line for the UI, event-aware. */
export function npcDialogue(sim: Sim, npcKey: string): string {
  const def = npcByKey(npcKey);
  if (sim.activeEvent && def.eventDialogue?.[sim.activeEvent]) {
    const lines = def.eventDialogue[sim.activeEvent];
    return lines[sim.rng.int(0, lines.length - 1)];
  }
  return def.dialogue[sim.rng.int(0, def.dialogue.length - 1)];
}

/** Shop price for an item from this NPC (happiness + merchant trait). */
export function shopPrice(sim: Sim, npcKey: string, itemValue: number, priceOverride: number, npcHappiness: number): number {
  const base = priceOverride > 0 ? priceOverride : itemValue;
  const trait = sim.bonus('shopPrices');
  return Math.max(1, Math.round((base * 1.5 * trait) / npcHappiness));
}
