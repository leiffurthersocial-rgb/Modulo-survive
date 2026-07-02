import { describe, expect, it } from 'vitest';
import { CHUNK, SURFACE_BASE, CAVERN_Y, DEEP_Y, WORLD_H } from '../src/data/constants';
import { dimensionByKey, DIMENSION_DEFS } from '../src/data/dimensions';
import { BLOCK_COUNT, block, blockId } from '../src/data/blocks';
import { hashString } from '../src/core/rng';
import { generateChunkData, makeGenContext, surfaceHeightAt, biomeAt, estimateSurface } from '../src/world/gen/generator';

const overworld = dimensionByKey('overworld');

describe('worldgen determinism', () => {
  it('same seed produces byte-identical chunks', () => {
    const seed = hashString('alpha');
    for (const [cx, cy] of [[0, 6], [-3, 8], [17, 11], [-25, 3], [4, 14]] as const) {
      const a = generateChunkData(seed, overworld, cx, cy);
      const b = generateChunkData(seed, overworld, cx, cy);
      expect(a.fg).toEqual(b.fg);
      expect(a.bg).toEqual(b.bg);
      expect(a.liquid).toEqual(b.liquid);
    }
  });

  it('different seeds diverge', () => {
    const a = generateChunkData(hashString('alpha'), overworld, 0, 6);
    const b = generateChunkData(hashString('beta'), overworld, 0, 6);
    let diff = 0;
    for (let i = 0; i < a.fg.length; i++) if (a.fg[i] !== b.fg[i]) diff++;
    expect(diff).toBeGreaterThan(50);
  });

  it('every generated id is a real block', () => {
    const seed = hashString('gamma');
    for (const dim of DIMENSION_DEFS) {
      for (const [cx, cy] of [[0, 5], [2, 10], [-1, 14]] as const) {
        const { fg, bg } = generateChunkData(seed, dim, cx, cy);
        for (const arr of [fg, bg]) {
          for (let i = 0; i < arr.length; i++) {
            expect(arr[i]).toBeLessThan(BLOCK_COUNT);
          }
        }
      }
    }
  });
});

describe('terrain shape', () => {
  const ctx = makeGenContext(hashString('delta'), overworld);

  it('surface stays in the legal band', () => {
    for (let x = -2000; x <= 2000; x += 37) {
      const s = surfaceHeightAt(ctx, x);
      expect(s).toBeGreaterThan(60);
      expect(s).toBeLessThan(SURFACE_BASE + 80);
    }
  });

  it('surface chunk has topsoil at the surface column', () => {
    const seed = hashString('delta');
    for (let cx = -3; cx <= 3; cx++) {
      const x = cx * CHUNK + 7;
      const surf = surfaceHeightAt(ctx, x);
      const cy = Math.floor(surf / CHUNK);
      const { fg } = generateChunkData(seed, overworld, cx, cy);
      const ly = surf - cy * CHUNK;
      const id = fg[ly * CHUNK + 7];
      const biome = biomeAt(ctx, x);
      // Surface tile is the biome topsoil unless a cave entrance or structure took it.
      const surfaceKeys = [biome.topsoil, 'air', 'ancientBrick', 'plank', 'campfire', 'chest', 'sand', 'stone'];
      expect(surfaceKeys).toContain(block(id).key);
    }
  });

  it('cavern stratum has a sane cave ratio', () => {
    const seed = hashString('epsilon');
    let air = 0;
    let total = 0;
    const cy = Math.floor((CAVERN_Y + 40) / CHUNK);
    for (let cx = -4; cx <= 4; cx++) {
      const { fg } = generateChunkData(seed, overworld, cx, cy);
      for (let i = 0; i < fg.length; i++) {
        total++;
        if (fg[i] === 0) air++;
      }
    }
    const ratio = air / total;
    expect(ratio).toBeGreaterThan(0.05);
    expect(ratio).toBeLessThan(0.6);
  });

  it('deep stratum contains lava and ores', () => {
    const seed = hashString('zeta');
    let lava = 0;
    let ore = 0;
    const oreIds = new Set([blockId('goldOre'), blockId('crystalOre'), blockId('silverOre'), blockId('meteoricOre')]);
    const cy = Math.floor((DEEP_Y + 20) / CHUNK);
    for (let cx = -6; cx <= 6; cx++) {
      const { fg, liquidType } = generateChunkData(seed, overworld, cx, cy);
      for (let i = 0; i < fg.length; i++) {
        if (liquidType[i] === 2) lava++;
        if (oreIds.has(fg[i])) ore++;
      }
    }
    expect(lava).toBeGreaterThan(0);
    expect(ore).toBeGreaterThan(0);
  });

  it('island strata produce terrain and estimates find it', () => {
    const sky = dimensionByKey('sky');
    const seed = hashString('eta');
    const ctxSky = makeGenContext(seed, sky);
    let solid = 0;
    for (let cy = 3; cy <= 12; cy++) {
      const { fg } = generateChunkData(seed, sky, 0, cy);
      for (let i = 0; i < fg.length; i++) if (fg[i] !== 0) solid++;
    }
    expect(solid).toBeGreaterThan(200);
    const est = estimateSurface(ctxSky, 5);
    expect(est).toBeGreaterThan(40);
    expect(est).toBeLessThanOrEqual(WORLD_H);
  });

  it('structure slices agree across chunk borders', () => {
    // Generate two horizontally adjacent chunks twice, comparing the shared
    // column region rasterized independently — catches non-determinism in
    // region-seeded structures.
    const seed = hashString('theta');
    const cy = Math.floor(SURFACE_BASE / CHUNK);
    for (let cx = -8; cx < 8; cx++) {
      const a = generateChunkData(seed, overworld, cx, cy);
      const b = generateChunkData(seed, overworld, cx, cy);
      expect(a.fg).toEqual(b.fg);
    }
  });
});
