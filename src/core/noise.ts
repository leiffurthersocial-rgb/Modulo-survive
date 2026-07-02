/**
 * Seeded 2-D value noise with quintic interpolation, plus fBm and ridged variants.
 * Pure and dependency-free so the worldgen worker, main thread and tests share it.
 */

import { fade, lerp } from './math';
import { hashCombine } from './rng';

/** Lattice value in [-1, 1] for integer coordinates. */
function lattice(seed: number, xi: number, yi: number): number {
  return (hashCombine(seed, xi, yi) / 4294967296) * 2 - 1;
}

export class Noise2D {
  constructor(private readonly seed: number) {}

  /** Smooth value noise in [-1, 1]. */
  sample(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = fade(xf);
    const v = fade(yf);
    const n00 = lattice(this.seed, xi, yi);
    const n10 = lattice(this.seed, xi + 1, yi);
    const n01 = lattice(this.seed, xi, yi + 1);
    const n11 = lattice(this.seed, xi + 1, yi + 1);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
  }

  /** Fractional Brownian motion in [-1, 1] (normalized). */
  fbm(x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      // Offset octaves so their lattices do not align into grid artifacts.
      sum += amp * this.sample(x * freq + i * 137.31, y * freq - i * 89.7);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  /** Ridged multifractal in [0, 1] — sharp crests for mountains and cave walls. */
  ridged(x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5): number {
    let amp = 0.5;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.sample(x * freq + i * 51.13, y * freq + i * 73.9));
      sum += amp * n * n;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}

/** 1-D convenience wrapper (terrain columns, cloud drift…). */
export class Noise1D {
  private readonly n: Noise2D;
  constructor(seed: number) {
    this.n = new Noise2D(seed);
  }
  sample(x: number): number {
    return this.n.sample(x, 0.5);
  }
  fbm(x: number, octaves: number, lacunarity = 2, gain = 0.5): number {
    return this.n.fbm(x, 0.5, octaves, lacunarity, gain);
  }
  ridged(x: number, octaves: number): number {
    return this.n.ridged(x, 0.5, octaves);
  }
}
