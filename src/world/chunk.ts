/** Typed-array chunk storage with dirty tracking. */

import { CHUNK } from '../data/constants';

export const CHUNK_AREA = CHUNK * CHUNK;

/** Liquid types in the liquid layer. */
export const LIQ_NONE = 0;
export const LIQ_WATER = 1;
export const LIQ_LAVA = 2;
export const LIQ_MAX = 8; // full cell amount

export interface ChunkData {
  fg: Uint16Array;
  bg: Uint16Array;
  liquid: Uint8Array;
  liquidType: Uint8Array;
}

export class Chunk {
  readonly cx: number;
  readonly cy: number;
  fg: Uint16Array;
  bg: Uint16Array;
  liquid: Uint8Array;
  liquidType: Uint8Array;
  /** Baked light (34×34: chunk + 1-tile border) for seam-free interpolation. */
  light: Uint8Array;
  /** Player has modified this chunk → must be persisted. */
  modified = false;
  /** Light needs recomputation. */
  lightDirty = true;
  /** Tile canvas needs re-bake. */
  visualDirty = true;
  /** Explored bitset for the map (1 bit per tile). */
  explored: Uint8Array;

  constructor(cx: number, cy: number, data?: ChunkData) {
    this.cx = cx;
    this.cy = cy;
    this.fg = data?.fg ?? new Uint16Array(CHUNK_AREA);
    this.bg = data?.bg ?? new Uint16Array(CHUNK_AREA);
    this.liquid = data?.liquid ?? new Uint8Array(CHUNK_AREA);
    this.liquidType = data?.liquidType ?? new Uint8Array(CHUNK_AREA);
    // Start bright, not black: avoids a dark flash before the first re-light.
    this.light = new Uint8Array(34 * 34).fill(215);
    this.explored = new Uint8Array(CHUNK_AREA / 8);
  }

  static idx(lx: number, ly: number): number {
    return ly * CHUNK + lx;
  }

  isExplored(lx: number, ly: number): boolean {
    const i = Chunk.idx(lx, ly);
    return (this.explored[i >> 3] & (1 << (i & 7))) !== 0;
  }

  setExplored(lx: number, ly: number): void {
    const i = Chunk.idx(lx, ly);
    this.explored[i >> 3] |= 1 << (i & 7);
  }
}

export const chunkKey = (cx: number, cy: number): string => `${cx}:${cy}`;
