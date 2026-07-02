/** World persistence: RLE chunk diffs + serialized game state, versioned. */

import { SAVE_VERSION } from '../data/constants';
import { BLOCK_DEFS, blockIdOpt } from '../data/blocks';
import { rleDecode16, rleDecode8, rleEncode } from '../core/rle';
import { CHUNK_AREA, type ChunkData } from '../world/chunk';
import type { Game, SerializedGame } from '../game/game';
import type { StorageAdapter } from './storage';
import { defaultStorage } from './storage';

export interface WorldSummary {
  id: string;
  name: string;
  seedText: string;
  characterKey: string;
  day: number;
  playedAt: number;
  version: number;
}

interface SavedChunk {
  dim: string;
  cx: number;
  cy: number;
  fg: Uint16Array;
  bg: Uint16Array;
  liquid: Uint16Array;
  liquidType: Uint16Array;
}

export interface WorldRecord {
  version: number;
  name: string;
  playedAt: number;
  /** id→key manifest: reordering the registry never corrupts saves. */
  blockManifest: string[];
  state: SerializedGame;
  chunks: SavedChunk[];
}

export async function saveWorld(game: Game, id: string, name: string, storage: StorageAdapter = defaultStorage): Promise<void> {
  const record: WorldRecord = {
    version: SAVE_VERSION,
    name,
    playedAt: Date.now(),
    blockManifest: BLOCK_DEFS.map((b) => b.key),
    state: game.serialize(),
    chunks: game.collectChunkDiffs().map((c) => ({
      dim: c.dim,
      cx: c.cx,
      cy: c.cy,
      fg: rleEncode(c.data.fg),
      bg: rleEncode(c.data.bg),
      liquid: rleEncode(c.data.liquid),
      liquidType: rleEncode(c.data.liquidType),
    })),
  };
  await storage.put('worlds', id, record);
}

export interface LoadedWorld {
  state: SerializedGame;
  applyChunks: (game: Game) => void;
}

export async function loadWorld(id: string, storage: StorageAdapter = defaultStorage): Promise<LoadedWorld | undefined> {
  const record = await storage.get<WorldRecord>('worlds', id);
  if (!record) return undefined;
  if (record.version > SAVE_VERSION) throw new Error('save from a newer version');

  // Remap block ids through the manifest in case the registry changed.
  const remap = new Map<number, number>();
  record.blockManifest.forEach((key, oldId) => {
    const now = blockIdOpt(key);
    remap.set(oldId, now ?? 0);
  });
  const needsRemap = record.blockManifest.some((key, oldId) => blockIdOpt(key) !== oldId);

  const applyChunks = (game: Game) => {
    for (const c of record.chunks) {
      const data: ChunkData = {
        fg: rleDecode16(c.fg, CHUNK_AREA),
        bg: rleDecode16(c.bg, CHUNK_AREA),
        liquid: rleDecode8(c.liquid, CHUNK_AREA),
        liquidType: rleDecode8(c.liquidType, CHUNK_AREA),
      };
      if (needsRemap) {
        for (let i = 0; i < CHUNK_AREA; i++) {
          data.fg[i] = remap.get(data.fg[i]) ?? 0;
          data.bg[i] = remap.get(data.bg[i]) ?? 0;
        }
      }
      game.restoreChunkDiff(c.dim, c.cx, c.cy, data);
    }
  };
  return { state: record.state, applyChunks };
}

export async function listWorlds(storage: StorageAdapter = defaultStorage): Promise<WorldSummary[]> {
  const ids = await storage.keys('worlds');
  const out: WorldSummary[] = [];
  for (const id of ids) {
    const r = await storage.get<WorldRecord>('worlds', id);
    if (!r) continue;
    out.push({
      id,
      name: r.name,
      seedText: r.state.seedText,
      characterKey: r.state.characterKey,
      day: r.state.day,
      playedAt: r.playedAt,
      version: r.version,
    });
  }
  return out.sort((a, b) => b.playedAt - a.playedAt);
}

export async function deleteWorld(id: string, storage: StorageAdapter = defaultStorage): Promise<void> {
  await storage.delete('worlds', id);
}
