/**
 * Per-chunk BFS lighting: skylight (via the world's exact skyline) + block
 * emissives, propagated over a chunk-with-apron window and written to the
 * chunk's 34×34 light buffer (1-tile border for seam-free bilinear sampling).
 */

import { CHUNK, LIGHT_MAX, WORLD_H } from '../data/constants';
import { block, blockOpacity } from '../data/blocks';
import { LIQ_LAVA } from './chunk';
import { Chunk } from './chunk';
import type { World } from './world';

const APRON = 8;
const SIZE = CHUNK + APRON * 2; // 48
const AREA = SIZE * SIZE;

// Reused scratch buffers (single-threaded lighting).
const lightBuf = new Float32Array(AREA);
const opacityBuf = new Uint8Array(AREA);
const queue = new Int32Array(AREA * 4);

/**
 * Recompute one chunk's light field.
 * @param dayLight 0..1 current sky brightness (already dimension-scaled).
 */
export function computeChunkLight(world: World, chunk: Chunk, dayLight: number): void {
  const x0 = chunk.cx * CHUNK - APRON;
  const y0 = chunk.cy * CHUNK - APRON;
  const skyLevel = dayLight * LIGHT_MAX;

  // Seed pass.
  let qn = 0;
  for (let ly = 0; ly < SIZE; ly++) {
    const wy = y0 + ly;
    for (let lx = 0; lx < SIZE; lx++) {
      const wx = x0 + lx;
      const i = ly * SIZE + lx;
      const id = wy < 0 || wy >= WORLD_H ? 0 : world.getTile(wx, wy);
      const def = block(id);
      opacityBuf[i] = blockOpacity(id);
      let l = 0;
      if (wy < 0 || (!def.solid && wy < world.getSkyline(wx))) l = skyLevel;
      if (def.light && def.light > l) l = def.light;
      if (world.getLiquid(wx, wy).type === LIQ_LAVA && l < 9) l = 9;
      lightBuf[i] = l;
      if (l > 0.5) queue[qn++] = i;
    }
  }

  // BFS propagation (4-neighborhood, attenuated by receiver opacity).
  let head = 0;
  while (head < qn) {
    const i = queue[head++];
    const l = lightBuf[i];
    if (l <= 1) continue;
    const lx = i % SIZE;
    const ly = (i / SIZE) | 0;
    // Unrolled neighbors.
    if (lx > 0) qn = spread(i - 1, l, qn);
    if (lx < SIZE - 1) qn = spread(i + 1, l, qn);
    if (ly > 0) qn = spread(i - SIZE, l, qn);
    if (ly < SIZE - 1) qn = spread(i + SIZE, l, qn);
    // Safety: queue can theoretically grow past AREA*4 on pathological fields.
    if (qn > queue.length - 8) break;
  }

  // Write central 34×34 (chunk + 1 border) into the chunk's buffer.
  const out = chunk.light;
  for (let oy = 0; oy < 34; oy++) {
    const sy = oy + APRON - 1;
    for (let ox = 0; ox < 34; ox++) {
      const sx = ox + APRON - 1;
      out[oy * 34 + ox] = Math.min(255, Math.round((lightBuf[sy * SIZE + sx] / LIGHT_MAX) * 255));
    }
  }
  chunk.lightDirty = false;
}

function spread(j: number, sourceLight: number, qn: number): number {
  const next = sourceLight - opacityBuf[j];
  if (next > lightBuf[j]) {
    lightBuf[j] = next;
    queue[qn++] = j;
  }
  return qn;
}
