/// <reference lib="webworker" />
/**
 * World generation worker: keeps chunk generation off the main thread.
 * Pure compute — imports only data + generator code (no DOM, no Pixi).
 */

import { dimensionByKey } from '../../data/dimensions';
import { generateChunkData } from './generator';

export interface GenRequest {
  id: number;
  seed: number;
  dimKey: string;
  cx: number;
  cy: number;
}

export interface GenResponse {
  id: number;
  cx: number;
  cy: number;
  fg: Uint16Array;
  bg: Uint16Array;
  liquid: Uint8Array;
  liquidType: Uint8Array;
}

self.onmessage = (e: MessageEvent<GenRequest>) => {
  const { id, seed, dimKey, cx, cy } = e.data;
  const data = generateChunkData(seed, dimensionByKey(dimKey), cx, cy);
  const res: GenResponse = { id, cx, cy, ...data };
  (self as unknown as Worker).postMessage(res, [
    data.fg.buffer,
    data.bg.buffer,
    data.liquid.buffer,
    data.liquidType.buffer,
  ]);
};
