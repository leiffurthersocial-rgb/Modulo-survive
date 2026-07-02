/** Chunk sources: worker-backed for the game, synchronous for tests/tools. */

import type { DimensionDef } from '../../data/types';
import type { ChunkData } from '../chunk';
import type { ChunkSource } from '../world';
import { estimateSurface, generateChunkData, makeGenContext, type GenContext } from './generator';
import type { GenRequest, GenResponse } from './worker';

abstract class BaseSource implements ChunkSource {
  protected ctx: GenContext;
  private estCache = new Map<number, number>();

  constructor(protected seed: number, protected dim: DimensionDef) {
    this.ctx = makeGenContext(seed, dim);
  }

  surfaceEstimate(x: number): number {
    let v = this.estCache.get(x);
    if (v === undefined) {
      v = estimateSurface(this.ctx, x);
      this.estCache.set(x, v);
    }
    return v;
  }

  abstract request(cx: number, cy: number, deliver: (data: ChunkData) => void): void;
}

interface PendingReq {
  cx: number;
  cy: number;
  deliver: (data: ChunkData) => void;
}

/** Generates in a Web Worker; falls back to sync generation if workers fail. */
export class WorkerChunkSource extends BaseSource {
  private worker: Worker | null = null;
  private pending = new Map<number, PendingReq>();
  private nextId = 1;

  constructor(seed: number, dim: DimensionDef) {
    super(seed, dim);
    try {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<GenResponse>) => {
        const { id, fg, bg, liquid, liquidType } = e.data;
        const req = this.pending.get(id);
        this.pending.delete(id);
        req?.deliver({ fg, bg, liquid, liquidType });
      };
      this.worker.onerror = () => {
        // Worker broke (e.g. CSP): finish pending requests synchronously,
        // then generate on the main thread from here on.
        const pending = [...this.pending.values()];
        this.pending.clear();
        this.worker?.terminate();
        this.worker = null;
        for (const req of pending) req.deliver(generateChunkData(this.seed, this.dim, req.cx, req.cy));
      };
    } catch {
      this.worker = null;
    }
  }

  request(cx: number, cy: number, deliver: (data: ChunkData) => void): void {
    if (!this.worker) {
      deliver(generateChunkData(this.seed, this.dim, cx, cy));
      return;
    }
    const id = this.nextId++;
    this.pending.set(id, { cx, cy, deliver });
    const req: GenRequest = { id, seed: this.seed, dimKey: this.dim.key, cx, cy };
    this.worker.postMessage(req);
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}

/** Synchronous source for tests and headless tools. */
export class SyncChunkSource extends BaseSource {
  request(cx: number, cy: number, deliver: (data: ChunkData) => void): void {
    deliver(generateChunkData(this.seed, this.dim, cx, cy));
  }
}
