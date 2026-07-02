/**
 * Game orchestrator: implements Sim, owns the fixed-step loop, the per-
 * dimension worlds, time/weather/events, drops, dimension travel and
 * (de)serialization for the save system.
 */

import { CAVERN_Y, CHUNK, DAY_LENGTH, DAY_START, DEEP_Y, STEP } from '../data/constants';
import { blockId } from '../data/blocks';
import { itemByKey } from '../data/items';
import { characterByKey } from '../data/characters';
import { dimensionByKey } from '../data/dimensions';
import type { BonusKey, CharacterDef } from '../data/types';
import { EventBus } from '../core/events';
import { hashString, RNG, streamOf } from '../core/rng';
import { clamp, posMod } from '../core/math';
import { World } from '../world/world';
import { WorkerChunkSource, SyncChunkSource } from '../world/gen/source';
import { stepLiquids } from '../world/liquids';
import { Chunk } from '../world/chunk';
import { makeEntity, sweepDead, type Entity } from './entities';
import { Inventory } from './inventory';
import { updatePlayer, createPlayer, accessoryTotal } from './player';
import { updateEnemies } from './ai';
import { updateBosses, checkDimensionBossTrigger } from './bosses';
import { updateProjectiles } from './projectiles';
import { updateSpawner } from './spawner';
import { updateNPCs, updateNPCArrivals } from './npcAI';
import { updateFarming } from './farming';
import { updateMachines, resetMachines } from './machines';
import { tickStatuses } from './combat';
import { applyGravity, moveEntity } from './physics';
import { checkPortalTravel } from './portals';
import { rollEvent, rollWeather, updateEvents, updateStorm, onMeteorImpact, type WorldEventState } from './worldEvents';
import { QuestLog } from './questlog';
import type { GameEvents, InputState, PlayerData, Sim } from './sim';

interface DimState {
  world: World;
  source: WorkerChunkSource | SyncChunkSource;
}

export interface GameOptions {
  seedText: string;
  characterKey: string;
  /** Tests / headless tools generate synchronously. */
  syncGen?: boolean;
  saved?: SerializedGame;
}

export class Game implements Sim {
  readonly seed: number;
  readonly seedText: string;
  readonly bus = new EventBus<GameEvents>();
  readonly flags = new Set<string>();
  readonly killCounter = new Map<string, number>();
  readonly quests: QuestLog;
  entities: Entity[] = [];
  player: Entity;
  rng: RNG;
  timeOfDay = DAY_START;
  day = 0;
  weather = 'clear';
  activeEvent: string | null = null;
  dimKey = 'overworld';
  paused = false;

  private dims = new Map<string, DimState>();
  private accumulator = 0;
  private questPollT = 0;
  private slowTickT = 0;
  private wasNight = false;
  private syncGen: boolean;
  private eventState: WorldEventState = { key: null, endsAt: 0, meteorTimer: 0, lightningTimer: 0, quakeTimer: 0 };
  private pendingTravel: string | null = null;
  /** Real elapsed play seconds (autosave pacing). */
  playSeconds = 0;

  constructor(opts: GameOptions) {
    this.seedText = opts.seedText;
    this.seed = hashString(opts.seedText);
    this.syncGen = !!opts.syncGen;
    this.rng = streamOf(this.seed, 'sim');
    resetMachines();

    const character: CharacterDef = characterByKey(opts.characterKey);
    this.ensureDim('overworld');
    const spawnX = 8;
    const spawnY = this.surfaceAt(spawnX) - 2;
    this.player = createPlayer(character, spawnX + 0.5, spawnY);
    (this.player.data as PlayerData).respawnX = spawnX + 0.5;
    (this.player.data as PlayerData).respawnY = spawnY;
    this.quests = QuestLog.deserialize(opts.saved?.quests);
    if (!opts.saved) this.quests.startMilestones();

    if (opts.saved) this.restore(opts.saved);

    // Bus wiring: quests + meteor impacts.
    this.bus.on('enemyKilled', ({ key }) => this.quests.onKill(this, key));
    this.bus.on('crafted', ({ itemKey, count }) => this.quests.onCraft(this, itemKey, count));

    // Preload the spawn area.
    this.world.update(Math.floor(this.player.x), Math.floor(this.player.y));
  }

  // ------------------------------------------------------------------ Sim API

  get world(): World {
    return this.dims.get(this.dimKey)!.world;
  }

  get source(): WorkerChunkSource | SyncChunkSource {
    return this.dims.get(this.dimKey)!.source;
  }

  bonus(key: BonusKey): number {
    return (this.player.data as PlayerData).character.bonuses[key] ?? 1;
  }

  addItem(key: string, count: number): void {
    const pd = this.player.data as PlayerData;
    if (key === 'coin') {
      pd.coins += count;
      return;
    }
    const left = pd.inventory.add(key, count);
    pd.seenItems.add(key);
    this.bus.emit('pickup', { itemKey: key, count: count - left });
    if (left > 0) {
      // No space: leave the remainder on the ground.
      const dropModule = { x: this.player.x, y: this.player.y };
      const e = makeEntity('drop', dropModule.x, dropModule.y, 0.28, 0.28);
      e.data = { itemKey: key, count: left, age: 0, noPickupT: 1.5 };
      this.entities.push(e);
    }
  }

  surfaceAt(x: number): number {
    return this.source.surfaceEstimate(x);
  }

  stratumAt(x: number, y: number): string {
    const surf = this.surfaceAt(x);
    if (y < surf - 24) return 'sky';
    if (y < surf + 24) return 'surface';
    if (y < CAVERN_Y) return 'underground';
    if (y < DEEP_Y) return 'cavern';
    return 'deep';
  }

  dayLight(): number {
    const dim = dimensionByKey(this.dimKey);
    let sky: number;
    const t = this.timeOfDay;
    // Smooth day curve: dawn 0.2–0.3, day 0.3–0.7, dusk 0.7–0.8, night rest.
    if (t < 0.2 || t > 0.8) sky = 0.12;
    else if (t < 0.3) sky = 0.12 + ((t - 0.2) / 0.1) * 0.88;
    else if (t < 0.7) sky = 1;
    else sky = 1 - ((t - 0.7) / 0.1) * 0.88;
    if (this.activeEvent === 'umbralVeil') sky = Math.min(sky, 0.22);
    if (this.weather === 'storm') sky *= 0.7;
    else if (this.weather === 'rain' || this.weather === 'snow' || this.weather === 'fog') sky *= 0.85;
    return clamp(sky * dim.skyLight, 0.06, 1);
  }

  isNight(): boolean {
    return this.timeOfDay < 0.22 || this.timeOfDay > 0.78;
  }

  // ------------------------------------------------------------------ loop

  /** Advance with real dt; runs 0..n fixed steps. Returns steps run. */
  update(dtReal: number, input: InputState): number {
    if (this.paused) return 0;
    this.playSeconds += dtReal;
    this.accumulator = Math.min(this.accumulator + dtReal, 0.25);
    let steps = 0;
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      this.step(input, STEP);
      steps++;
      // Only the first step consumes edge-triggered inputs.
      input = { ...input, jumpPressed: false, dodgePressed: false, usePressed: false, interactPressed: false, hotbar: -1 };
    }
    return steps;
  }

  private step(input: InputState, dt: number): void {
    // Record previous positions first so rendering can interpolate.
    this.player.px = this.player.x;
    this.player.py = this.player.y;
    for (const e of this.entities) {
      e.px = e.x;
      e.py = e.y;
    }

    // --- time & schedule ---
    const prevT = this.timeOfDay;
    this.timeOfDay += dt / DAY_LENGTH;
    if (this.timeOfDay >= 1) {
      this.timeOfDay -= 1;
      this.day++;
    }
    const nightNow = this.isNight();
    if (nightNow !== this.wasNight) {
      this.wasNight = nightNow;
      rollEvent(this, this.eventState, nightNow);
      this.activeEvent = this.eventState.key;
      if (!nightNow) {
        this.weather = rollWeather(this);
        this.bus.emit('weatherChanged', { key: this.weather });
        updateNPCArrivals(this);
      }
    }
    // Dawn crossing for midday weather variation.
    if (prevT < 0.5 && this.timeOfDay >= 0.5 && this.rng.chance(0.3)) {
      this.weather = rollWeather(this);
      this.bus.emit('weatherChanged', { key: this.weather });
    }

    // --- chunk streaming around the player ---
    this.world.update(Math.floor(this.player.x), Math.floor(this.player.y));

    // --- systems, deterministic order ---
    updatePlayer(this, input, dt);
    updateEnemies(this, dt);
    updateBosses(this, dt);
    updateNPCs(this, dt);
    updateProjectiles(this, dt);
    this.updateDrops(dt);
    for (const e of this.entities) {
      if (!e.dead) tickStatuses(this, e, dt);
      if (e.iframes > 0) e.iframes -= dt;
    }
    tickStatuses(this, this.player, dt);
    if (this.player.iframes > 0) this.player.iframes -= dt;

    stepLiquids(this.world, 240);
    updateSpawner(this, dt);
    updateEvents(this, this.eventState, dt);
    updateStorm(this, this.eventState, dt);
    this.activeEvent = this.eventState.key;

    // Meteor impacts convert terrain.
    for (const e of this.entities) {
      if (e.kind === 'projectile' && e.dead && e.data.meteor && !e.data.meteorDone) {
        e.data.meteorDone = true;
        onMeteorImpact(this, e.x, e.y);
      }
    }

    // --- sliced slow ticks ---
    this.slowTickT -= dt;
    if (this.slowTickT <= 0) {
      this.slowTickT = 1;
      updateFarming(this, 1);
      updateMachines(this, 1);
      checkDimensionBossTrigger(this);
      this.markExplored();
    }
    this.questPollT -= dt;
    if (this.questPollT <= 0) {
      this.questPollT = 1;
      this.quests.poll(this);
    }

    // --- portal travel ---
    const travel = checkPortalTravel(this);
    if (travel && !this.pendingTravel) {
      this.pendingTravel = travel;
      this.travelTo(travel);
    } else if (!travel) {
      this.pendingTravel = null;
    }

    sweepDead(this.entities);
  }

  private updateDrops(dt: number): void {
    const p = this.player;
    const pd = p.data as PlayerData;
    const magnet = 3.5 + accessoryTotal(pd, 'magnet');
    for (const e of this.entities) {
      if (e.kind !== 'drop' || e.dead) continue;
      e.data.age += dt;
      if (e.data.noPickupT > 0) e.data.noPickupT -= dt;
      if (e.data.age > 180) {
        e.dead = true;
        continue;
      }
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < magnet && !(e.data.noPickupT > 0)) {
        e.vx += (dx / (dist || 1)) * 40 * dt;
        e.vy += (dy / (dist || 1)) * 40 * dt;
        e.gravityMult = 0;
      } else {
        e.gravityMult = 1;
        applyGravity(e, dt);
        e.vx *= 0.98;
      }
      moveEntity(this.world, e, dt);
      // Pickup.
      if (dist < 0.9 && e.data.age > 0.3 && !(e.data.noPickupT > 0)) {
        e.dead = true;
        this.addItem(e.data.itemKey, e.data.count);
        this.bus.emit('sound', { key: e.data.itemKey === 'coin' ? 'coin' : 'pickup', x: e.x, y: e.y });
      }
    }
  }

  private markExplored(): void {
    const px = Math.floor(this.player.x);
    const py = Math.floor(this.player.y);
    const r = Math.round(24 * this.bonus('visionRadius'));
    for (let dy = -r; dy <= r; dy += 2) {
      for (let dx = -r; dx <= r; dx += 2) {
        if (dx * dx + dy * dy > r * r) continue;
        const chunk = this.world.chunkOf(px + dx, py + dy);
        if (chunk) chunk.setExplored(posMod(px + dx, CHUNK), posMod(py + dy, CHUNK));
      }
    }
  }

  // ------------------------------------------------------------------ dimensions

  private ensureDim(key: string): DimState {
    let d = this.dims.get(key);
    if (!d) {
      const dim = dimensionByKey(key);
      const source = this.syncGen ? new SyncChunkSource(this.seed, dim) : new WorkerChunkSource(this.seed, dim);
      const world = new World(dim, source);
      d = { world, source };
      this.dims.set(key, d);
    }
    return d;
  }

  travelTo(targetDim: string): void {
    const fromDim = this.dimKey;
    this.ensureDim(targetDim);
    this.dimKey = targetDim;
    // Clear cross-dimension entities (drops stay behind, enemies despawn).
    this.entities = this.entities.filter((e) => e.kind === 'npc');
    this.bus.emit('bossBar', null);

    const p = this.player;
    const arriveX = Math.floor(p.x);
    this.world.update(arriveX, 200);
    const surf = this.surfaceAt(arriveX);
    p.x = arriveX + 0.5;
    p.y = surf - 3;
    p.vx = 0;
    p.vy = 0;
    p.iframes = 2;
    this.buildArrivalPortal(arriveX, surf, fromDim);
    this.bus.emit('portalUsed', { toDim: targetDim });
    this.bus.emit('musicCue', { key: dimensionByKey(targetDim).musicKey });
    this.bus.emit('banner', {
      title: dimensionByKey(targetDim).name,
      sub: 'The lattice folds around you',
      color: 0x9a7ae8,
    });
    // Nudge streaming immediately so the player never falls through.
    this.world.update(arriveX, Math.floor(p.y));
  }

  /** Carve a small arrival platform with a return portal. */
  private buildArrivalPortal(x: number, surf: number, backTo: string): void {
    const w = this.world;
    const interiorKey = `${x + 4},${surf - 4}`;
    if (w.portals.has(interiorKey)) return; // already built
    const dim = dimensionByKey(backTo);
    const frame = dim.frameBlock ? blockId(dim.frameBlock) : blockId('obsidianBrick');
    const core = blockId('portalCore');
    // Platform.
    for (let dx = -1; dx <= 8; dx++) w.setTile(x + dx, surf, blockId(this.world.dim.stone));
    // Clear headroom.
    for (let dx = -1; dx <= 8; dx++) {
      for (let dy = 1; dy <= 6; dy++) w.setTile(x + dx, surf - dy, 0);
    }
    // Ring at (x+3..x+6, surf-5..surf-1), interior 2×3 at (x+4..x+5, surf-4..surf-2).
    for (let rx = x + 3; rx <= x + 6; rx++) {
      for (let ry = surf - 5; ry <= surf - 1; ry++) {
        const interior = rx >= x + 4 && rx <= x + 5 && ry >= surf - 4 && ry <= surf - 2;
        w.setTile(rx, ry, interior ? core : frame);
      }
    }
    w.portals.set(interiorKey, backTo);
  }

  // ------------------------------------------------------------------ save/load

  serialize(): SerializedGame {
    const pd = this.player.data as PlayerData;
    return {
      seedText: this.seedText,
      characterKey: pd.character.key,
      timeOfDay: this.timeOfDay,
      day: this.day,
      weather: this.weather,
      dimKey: this.dimKey,
      flags: [...this.flags],
      kills: [...this.killCounter],
      quests: this.quests.serialize(),
      player: {
        x: this.player.x,
        y: this.player.y,
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        mana: pd.mana,
        hunger: pd.hunger,
        coins: pd.coins,
        respawnX: pd.respawnX,
        respawnY: pd.respawnY,
        inventory: pd.inventory.serialize(),
        armor: pd.armor.serialize(),
        accessories: pd.accessories.serialize(),
        seenItems: [...pd.seenItems],
        placedCount: pd.placedCount,
      },
      dims: [...this.dims.entries()].map(([key, d]) => ({
        key,
        portals: [...d.world.portals],
        chests: [...d.world.chests.entries()].map(([k, inv]) => [k, (inv as Inventory).serialize()] as [string, ([string, number] | null)[]]),
      })),
      npcs: this.entities
        .filter((e) => e.kind === 'npc' && !e.dead)
        .map((e) => ({ key: e.data.defKey, x: e.x, y: e.y, homeX: e.data.homeX, homeY: e.data.homeY })),
    };
  }

  private restore(s: SerializedGame): void {
    this.timeOfDay = s.timeOfDay;
    this.day = s.day;
    this.weather = s.weather;
    for (const f of s.flags) this.flags.add(f);
    for (const [k, v] of s.kills) this.killCounter.set(k, v);
    const pd = this.player.data as PlayerData;
    this.player.x = s.player.x;
    this.player.y = s.player.y;
    this.player.hp = s.player.hp;
    this.player.maxHp = s.player.maxHp;
    pd.mana = s.player.mana;
    pd.hunger = s.player.hunger;
    pd.coins = s.player.coins;
    pd.respawnX = s.player.respawnX;
    pd.respawnY = s.player.respawnY;
    pd.inventory = Inventory.deserialize(s.player.inventory, pd.inventory.slots.length);
    pd.armor = Inventory.deserialize(s.player.armor, pd.armor.slots.length);
    pd.accessories = Inventory.deserialize(s.player.accessories, pd.accessories.slots.length);
    pd.seenItems = new Set(s.player.seenItems);
    pd.placedCount = s.player.placedCount;
    for (const d of s.dims) {
      const dim = this.ensureDim(d.key);
      for (const [k, v] of d.portals) dim.world.portals.set(k, v);
      for (const [k, inv] of d.chests) dim.world.chests.set(k, Inventory.deserialize(inv, 32));
    }
    this.dimKey = s.dimKey;
    for (const n of s.npcs) {
      const e = makeEntity('npc', n.x, n.y, 0.38, 0.85);
      e.hp = 250;
      e.maxHp = 250;
      e.data = { defKey: n.key, homeX: n.homeX, homeY: n.homeY, hasHome: true, happiness: 1, wanderDir: 1, wanderT: 0, canStep: true };
      this.entities.push(e);
    }
    this.wasNight = this.isNight();
  }

  /** Chunk diffs for every dimension (persisted separately from meta). */
  collectChunkDiffs(): { dim: string; cx: number; cy: number; data: { fg: Uint16Array; bg: Uint16Array; liquid: Uint8Array; liquidType: Uint8Array } }[] {
    const out: { dim: string; cx: number; cy: number; data: { fg: Uint16Array; bg: Uint16Array; liquid: Uint8Array; liquidType: Uint8Array } }[] = [];
    for (const [key, d] of this.dims) {
      for (const m of d.world.collectModified()) out.push({ dim: key, ...m });
    }
    return out;
  }

  restoreChunkDiff(dim: string, cx: number, cy: number, data: { fg: Uint16Array; bg: Uint16Array; liquid: Uint8Array; liquidType: Uint8Array }): void {
    this.ensureDim(dim).world.restoreChunk(cx, cy, data);
  }

  /** Explored-map data for the active dimension (for the map screen). */
  exploredChunks(): Chunk[] {
    return [...this.world.chunks.values()];
  }

  dispose(): void {
    for (const d of this.dims.values()) {
      if (d.source instanceof WorkerChunkSource) d.source.dispose();
    }
    this.bus.clear();
  }
}

export interface SerializedGame {
  seedText: string;
  characterKey: string;
  timeOfDay: number;
  day: number;
  weather: string;
  dimKey: string;
  flags: string[];
  kills: [string, number][];
  quests: { active: [string, number, boolean][]; completed: string[] };
  player: {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    mana: number;
    hunger: number;
    coins: number;
    respawnX: number;
    respawnY: number;
    inventory: ([string, number] | null)[];
    armor: ([string, number] | null)[];
    accessories: ([string, number] | null)[];
    seenItems: string[];
    placedCount: number;
  };
  dims: { key: string; portals: [string, string][]; chests: [string, ([string, number] | null)[]][] }[];
  npcs: { key: string; x: number; y: number; homeX: number; homeY: number }[];
}

/** Chest access helper shared by UI and player interaction. */
export function chestAt(game: Game, x: number, y: number): Inventory {
  const key = `${x},${y}`;
  let inv = game.world.chests.get(key) as Inventory | undefined;
  if (!inv) {
    inv = new Inventory(32);
    // Natural chests (never opened) roll loot from position + stratum.
    fillNaturalChest(game, inv, x, y);
    game.world.chests.set(key, inv);
  }
  return inv;
}

function fillNaturalChest(game: Game, inv: Inventory, x: number, y: number): void {
  const tile = game.world.getTile(x, y);
  const key = tile !== 0 ? undefined : undefined;
  void key;
  const isGold = tile === blockId('goldChest');
  // Player-placed chests start empty: detect via placed flag in world chests…
  // Natural chests are exactly those the generator placed; the player's own
  // chests get registered on placement (see UI open path) — here we only fill
  // when the tile was generated (heuristic: unmodified chunk or gold chest).
  const chunk = game.world.chunkOf(x, y);
  if (!isGold && chunk?.modified) return;
  const rng = streamOf(game.seed, 'chest', x, y);
  const stratum = game.stratumAt(x, y);
  const luck = game.bonus('lootLuck');
  const table: [string, number, number, number][] = isGold
    ? [
        ['goldBar', 2, 5, 0.9], ['healingDraughtM', 1, 3, 0.7], ['featherSigil', 1, 1, 0.12 * luck],
        ['eagleEye', 1, 1, 0.12 * luck], ['coin', 40, 120, 1], ['crystalOre', 3, 8, 0.6],
        ['gearScrap', 2, 6, 0.4], ['manaLoop', 1, 1, 0.1 * luck], ['galePiercer', 1, 1, 0.05 * luck],
      ]
    : stratum === 'deep' || stratum === 'cavern'
      ? [
          ['silverBar', 1, 4, 0.7], ['healingDraughtS', 1, 3, 0.8], ['rope', 5, 15, 0.6],
          ['coin', 15, 60, 1], ['crystalOre', 2, 5, 0.5], ['swiftBand', 1, 1, 0.1 * luck],
          ['throwingStone', 5, 15, 0.5], ['circuit', 1, 2, 0.25],
        ]
      : [
          ['torch', 4, 10, 0.9], ['healingDraughtS', 1, 2, 0.7], ['arrow', 8, 20, 0.7],
          ['coin', 5, 25, 1], ['copperBar', 1, 4, 0.6], ['amberkornSeeds', 1, 3, 0.4],
          ['berrySeeds', 1, 3, 0.4], ['leapCharm', 1, 1, 0.07 * luck], ['travelRations', 1, 2, 0.3],
        ];
  for (const [item, min, max, chance] of table) {
    if (rng.next() < chance) inv.add(item, rng.int(min, max));
  }
}

/** Item value lookup for shops/UI without importing data everywhere. */
export function valueOf(key: string): number {
  return itemByKey(key).value;
}
