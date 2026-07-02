/**
 * A streaming, infinite-X world for one dimension: chunk lifecycle, tile access,
 * skyline tracking (exact skylight seeds), dirty flags and liquid activation.
 * Chunk data arrives from a ChunkSource (worker on the main thread, synchronous
 * generator in tests) — the world never generates terrain itself.
 */

import { CHUNK, EVICT_MARGIN, LOAD_RADIUS_X, LOAD_RADIUS_Y, WORLD_CH, WORLD_H } from '../data/constants';
import { AIR, block, blockId } from '../data/blocks';
import type { DimensionDef } from '../data/types';
import { floorDiv, posMod } from '../core/math';
import { Chunk, chunkKey, LIQ_NONE, type ChunkData } from './chunk';

export interface ChunkSource {
  /** Request async generation; must eventually call deliver exactly once. */
  request(cx: number, cy: number, deliver: (data: ChunkData) => void): void;
  /** Best-effort surface height estimate for unloaded columns (skylight). */
  surfaceEstimate(x: number): number;
}

export interface WorldEvents {
  onChunkReady?: (chunk: Chunk) => void;
  onChunkEvicted?: (chunk: Chunk) => void;
  onTileChanged?: (x: number, y: number) => void;
}

export class World {
  readonly dim: DimensionDef;
  readonly chunks = new Map<string, Chunk>();
  private pending = new Set<string>();
  private source: ChunkSource;
  private events: WorldEvents;
  /** Per-column y of the topmost solid tile (skylight boundary). */
  private skyline = new Map<number, number>();
  /** Liquid cells that need simulation, packed as "x,y". */
  readonly activeLiquid = new Set<string>();
  /** Chest inventories keyed by "x,y" (slots managed by game/inventory). */
  readonly chests = new Map<string, unknown>();
  /** Chunk diffs restored from a save, applied when the chunk generates. */
  private savedChunks = new Map<string, ChunkData>();

  constructor(dim: DimensionDef, source: ChunkSource, events: WorldEvents = {}) {
    this.dim = dim;
    this.source = source;
    this.events = events;
  }

  // -------------------------------------------------------------------------
  // Chunk lifecycle
  // -------------------------------------------------------------------------

  chunkAt(cx: number, cy: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cy));
  }

  chunkOf(x: number, y: number): Chunk | undefined {
    return this.chunkAt(floorDiv(x, CHUNK), floorDiv(y, CHUNK));
  }

  /** Provide a chunk diff from a save; applied when/if the chunk loads. */
  restoreChunk(cx: number, cy: number, data: ChunkData): void {
    this.savedChunks.set(chunkKey(cx, cy), data);
  }

  /** Stream chunks around a center tile; evict far ones. Returns evicted modified chunks. */
  update(centerX: number, centerY: number): Chunk[] {
    const ccx = floorDiv(centerX, CHUNK);
    const ccy = floorDiv(centerY, CHUNK);
    for (let dx = -LOAD_RADIUS_X; dx <= LOAD_RADIUS_X; dx++) {
      for (let dy = -LOAD_RADIUS_Y; dy <= LOAD_RADIUS_Y; dy++) {
        const cy = ccy + dy;
        if (cy < 0 || cy >= WORLD_CH) continue;
        this.ensureRequested(ccx + dx, cy);
      }
    }
    const evicted: Chunk[] = [];
    for (const [key, chunk] of this.chunks) {
      if (
        Math.abs(chunk.cx - ccx) > LOAD_RADIUS_X + EVICT_MARGIN ||
        Math.abs(chunk.cy - ccy) > LOAD_RADIUS_Y + EVICT_MARGIN
      ) {
        this.chunks.delete(key);
        if (chunk.modified) {
          this.savedChunks.set(key, { fg: chunk.fg, bg: chunk.bg, liquid: chunk.liquid, liquidType: chunk.liquidType });
          evicted.push(chunk);
        }
        this.events.onChunkEvicted?.(chunk);
      }
    }
    return evicted;
  }

  private ensureRequested(cx: number, cy: number): void {
    const key = chunkKey(cx, cy);
    if (this.chunks.has(key) || this.pending.has(key)) return;
    this.pending.add(key);
    const saved = this.savedChunks.get(key);
    if (saved) {
      this.adoptChunk(cx, cy, {
        fg: saved.fg.slice(),
        bg: saved.bg.slice(),
        liquid: saved.liquid.slice(),
        liquidType: saved.liquidType.slice(),
      }, true);
      return;
    }
    this.source.request(cx, cy, (data) => {
      // A save diff may have arrived while generation was in flight.
      const late = this.savedChunks.get(key);
      this.adoptChunk(cx, cy, late ?? data, !!late);
    });
  }

  private adoptChunk(cx: number, cy: number, data: ChunkData, wasModified: boolean): void {
    const key = chunkKey(cx, cy);
    this.pending.delete(key);
    const chunk = new Chunk(cx, cy, data);
    chunk.modified = wasModified;
    this.chunks.set(key, chunk);
    this.activateChunkLiquids(chunk);
    this.markLightDirtyAround(cx * CHUNK + CHUNK / 2, cy * CHUNK + CHUNK / 2, CHUNK);
    this.events.onChunkReady?.(chunk);
  }

  /** All currently-modified chunks plus evicted diffs — the save payload. */
  collectModified(): { cx: number; cy: number; data: ChunkData }[] {
    const out: { cx: number; cy: number; data: ChunkData }[] = [];
    const seen = new Set<string>();
    for (const chunk of this.chunks.values()) {
      if (!chunk.modified) continue;
      const key = chunkKey(chunk.cx, chunk.cy);
      seen.add(key);
      out.push({ cx: chunk.cx, cy: chunk.cy, data: { fg: chunk.fg, bg: chunk.bg, liquid: chunk.liquid, liquidType: chunk.liquidType } });
    }
    for (const [key, data] of this.savedChunks) {
      if (seen.has(key)) continue;
      const [cx, cy] = key.split(':').map(Number);
      out.push({ cx, cy, data });
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Tile access
  // -------------------------------------------------------------------------

  getTile(x: number, y: number): number {
    if (y < 0 || y >= WORLD_H) return AIR;
    const c = this.chunkOf(x, y);
    return c ? c.fg[Chunk.idx(posMod(x, CHUNK), posMod(y, CHUNK))] : AIR;
  }

  getWall(x: number, y: number): number {
    if (y < 0 || y >= WORLD_H) return AIR;
    const c = this.chunkOf(x, y);
    return c ? c.bg[Chunk.idx(posMod(x, CHUNK), posMod(y, CHUNK))] : AIR;
  }

  /** Is the tile's chunk loaded? (physics treats unloaded as solid) */
  isLoaded(x: number, y: number): boolean {
    return y < 0 || y >= WORLD_H || this.chunkOf(x, y) !== undefined;
  }

  isSolid(x: number, y: number): boolean {
    if (y >= WORLD_H) return true;
    if (y < 0) return false;
    const c = this.chunkOf(x, y);
    if (!c) return true; // unloaded acts solid so nothing falls out of the world
    return block(c.fg[Chunk.idx(posMod(x, CHUNK), posMod(y, CHUNK))]).solid;
  }

  setTile(x: number, y: number, id: number): void {
    if (y < 0 || y >= WORLD_H) return;
    const c = this.chunkOf(x, y);
    if (!c) return;
    const i = Chunk.idx(posMod(x, CHUNK), posMod(y, CHUNK));
    if (c.fg[i] === id) return;
    const before = block(c.fg[i]);
    c.fg[i] = id;
    c.modified = true;
    c.visualDirty = true;
    this.updateSkyline(x, y, block(id).solid, before.solid);
    this.markLightDirtyAround(x, y, 10);
    this.wakeLiquids(x, y);
    this.events.onTileChanged?.(x, y);
  }

  setWall(x: number, y: number, id: number): void {
    if (y < 0 || y >= WORLD_H) return;
    const c = this.chunkOf(x, y);
    if (!c) return;
    const i = Chunk.idx(posMod(x, CHUNK), posMod(y, CHUNK));
    if (c.bg[i] === id) return;
    c.bg[i] = id;
    c.modified = true;
    c.visualDirty = true;
    this.markLightDirtyAround(x, y, 4);
    this.events.onTileChanged?.(x, y);
  }

  getLiquid(x: number, y: number): { type: number; amount: number } {
    const c = this.chunkOf(x, y);
    if (!c || y < 0 || y >= WORLD_H) return { type: LIQ_NONE, amount: 0 };
    const i = Chunk.idx(posMod(x, CHUNK), posMod(y, CHUNK));
    return { type: c.liquidType[i], amount: c.liquid[i] };
  }

  setLiquid(x: number, y: number, type: number, amount: number): void {
    if (y < 0 || y >= WORLD_H) return;
    const c = this.chunkOf(x, y);
    if (!c) return;
    const i = Chunk.idx(posMod(x, CHUNK), posMod(y, CHUNK));
    c.liquid[i] = amount;
    c.liquidType[i] = amount > 0 ? type : LIQ_NONE;
    c.modified = true;
    c.visualDirty = true;
    if (amount > 0) this.activeLiquid.add(`${x},${y}`);
    this.wakeLiquids(x, y);
  }

  private wakeLiquids(x: number, y: number): void {
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 0], [0, 1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.getLiquid(nx, ny).amount > 0) this.activeLiquid.add(`${nx},${ny}`);
    }
  }

  private activateChunkLiquids(chunk: Chunk): void {
    for (let ly = 0; ly < CHUNK; ly++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        if (chunk.liquid[Chunk.idx(lx, ly)] > 0) {
          this.activeLiquid.add(`${chunk.cx * CHUNK + lx},${chunk.cy * CHUNK + ly}`);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Skyline (exact skylight boundary per column)
  // -------------------------------------------------------------------------

  getSkyline(x: number): number {
    const s = this.skyline.get(x);
    return s !== undefined ? s : this.source.surfaceEstimate(x);
  }

  private updateSkyline(x: number, y: number, nowSolid: boolean, wasSolid: boolean): void {
    const current = this.getSkyline(x);
    if (nowSolid && y < current) {
      this.skyline.set(x, y);
    } else if (!nowSolid && wasSolid && y === current) {
      // Removed the skyline tile: rescan downward.
      let ny = y + 1;
      while (ny < WORLD_H && !this.isSolidLoadedOnly(x, ny)) ny++;
      this.skyline.set(x, ny);
    }
  }

  private isSolidLoadedOnly(x: number, y: number): boolean {
    const c = this.chunkOf(x, y);
    if (!c) return true;
    return block(c.fg[Chunk.idx(posMod(x, CHUNK), posMod(y, CHUNK))]).solid;
  }

  // -------------------------------------------------------------------------
  // Dirty tracking
  // -------------------------------------------------------------------------

  markLightDirtyAround(x: number, y: number, radius: number): void {
    const c0x = floorDiv(x - radius, CHUNK);
    const c1x = floorDiv(x + radius, CHUNK);
    const c0y = floorDiv(y - radius, CHUNK);
    const c1y = floorDiv(y + radius, CHUNK);
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cy = c0y; cy <= c1y; cy++) {
        const c = this.chunkAt(cx, cy);
        if (c) c.lightDirty = true;
      }
    }
  }

  markAllLightDirty(): void {
    for (const c of this.chunks.values()) c.lightDirty = true;
  }

  // -------------------------------------------------------------------------
  // Interaction helpers
  // -------------------------------------------------------------------------

  /** Toggle a door tile between open and closed variants. */
  toggleDoor(x: number, y: number): boolean {
    const id = this.getTile(x, y);
    const def = block(id);
    if (def.furniture !== 'door') return false;
    const open = def.key.endsWith('Open');
    const other = open ? def.key.slice(0, -4) : `${def.key}Open`;
    this.setTile(x, y, blockId(other));
    return true;
  }
}
