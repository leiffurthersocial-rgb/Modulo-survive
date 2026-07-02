/** Core utilities: RNG determinism, noise ranges, RLE roundtrip. */

import { describe, expect, it } from 'vitest';
import { RNG, hashString, hashCombine, hash01, streamOf } from '../src/core/rng';
import { Noise2D } from '../src/core/noise';
import { rleDecode16, rleDecode8, rleEncode } from '../src/core/rle';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = new RNG(1234);
    const b = new RNG(1234);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('forked streams are independent of draw order', () => {
    const base1 = streamOf('seed', 'x');
    const base2 = streamOf('seed', 'x');
    base2.next(); // draws on one stream…
    const f1 = streamOf('seed', 'y').next();
    const f2 = streamOf('seed', 'y').next();
    expect(f1).toBe(f2); // …never shift a sibling stream
    expect(base1.next()).not.toBe(f1);
  });
  it('hashes are stable and well-spread', () => {
    expect(hashString('modulo')).toBe(hashString('modulo'));
    expect(hashString('modulo')).not.toBe(hashString('modulp'));
    expect(hashCombine(1, 2, 3)).not.toBe(hashCombine(3, 2, 1));
    // hash01 mean should be near 0.5.
    let sum = 0;
    for (let i = 0; i < 2000; i++) sum += hash01(42, i, i * 7, 3);
    expect(sum / 2000).toBeGreaterThan(0.45);
    expect(sum / 2000).toBeLessThan(0.55);
  });
  it('int() covers its range inclusively', () => {
    const r = new RNG(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(r.int(1, 4));
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('noise', () => {
  it('stays within [-1, 1] and is seed-stable', () => {
    const n = new Noise2D(99);
    const m = new Noise2D(99);
    for (let i = 0; i < 500; i++) {
      const x = i * 0.37;
      const y = i * 0.53;
      const v = n.fbm(x, y, 4);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBe(m.fbm(x, y, 4));
    }
  });
  it('ridged output is in [0, 1]', () => {
    const n = new Noise2D(5);
    for (let i = 0; i < 200; i++) {
      const v = n.ridged(i * 0.31, i * 0.17, 4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('rle', () => {
  it('roundtrips u16 and u8 arrays', () => {
    const u16 = new Uint16Array(1024);
    for (let i = 0; i < 1024; i++) u16[i] = i < 500 ? 3 : i % 7 === 0 ? 250 : 9;
    expect(rleDecode16(rleEncode(u16), 1024)).toEqual(u16);

    const u8 = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) u8[i] = (i * 31) % 5 === 0 ? 8 : 0;
    expect(rleDecode8(rleEncode(u8), 1024)).toEqual(u8);
  });
  it('compresses uniform data massively', () => {
    const flat = new Uint16Array(1024).fill(7);
    expect(rleEncode(flat).length).toBe(2);
  });
  it('rejects wrong lengths', () => {
    const enc = rleEncode(new Uint16Array(10));
    expect(() => rleDecode16(enc, 11)).toThrow();
  });
});
