/**
 * Deterministic randomness. All simulation and generation randomness flows through
 * this module — never `Math.random` — so worlds reproduce from their seed and the
 * fixed-step simulation stays replayable (see docs/NETWORKING.md).
 */

/** xmur3 string hash → 32-bit uint. Stable across platforms. */
export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** Mix multiple 32-bit values into one (order-sensitive). */
export function hashCombine(...vals: number[]): number {
  let h = 2166136261 >>> 0;
  for (const v of vals) {
    let x = v | 0;
    x = Math.imul(x ^ (x >>> 16), 2246822507);
    x = Math.imul(x ^ (x >>> 13), 3266489909);
    h = (Math.imul(h ^ x, 16777619) ^ (h >>> 15)) >>> 0;
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Fast per-coordinate hash → [0, 1). Used for per-tile deterministic rolls. */
export function hash01(seed: number, x: number, y: number, salt = 0): number {
  return hashCombine(seed, x, y, salt) / 4294967296;
}

/** sfc32 — small fast counter PRNG. Good stats, 128-bit state, deterministic. */
export class RNG {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    // Splash the single 32-bit seed across the state, then warm up.
    this.a = seed >>> 0;
    this.b = hashCombine(seed, 0x9e3779b9);
    this.c = hashCombine(seed, 0x85ebca6b);
    this.d = hashCombine(seed, 0xc2b2ae35);
    for (let i = 0; i < 8; i++) this.next();
  }

  /** Uniform float in [0, 1). */
  next(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Weighted pick from [item, weight] pairs. */
  pickWeighted<T>(pairs: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, w] of pairs) total += w;
    let r = this.next() * total;
    for (const [item, w] of pairs) {
      r -= w;
      if (r <= 0) return item;
    }
    return pairs[pairs.length - 1][0];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Derive an independent child stream; changing one feature's rolls never shifts another's. */
  fork(...salts: (number | string)[]): RNG {
    const parts = salts.map((s) => (typeof s === 'string' ? hashString(s) : s | 0));
    return new RNG(hashCombine(this.a ^ this.d, ...parts));
  }
}

/** Convenience: seeded stream from a string seed plus salt path. */
export function streamOf(seed: string | number, ...salts: (number | string)[]): RNG {
  const base = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  const parts = salts.map((s) => (typeof s === 'string' ? hashString(s) : s | 0));
  return new RNG(hashCombine(base, ...parts));
}
