/** Zero-dependency math helpers shared by simulation and rendering. */

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Quintic fade used by noise interpolation (C2-continuous). */
export const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number): number => t * t * t;

export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};

export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.sqrt(dist2(ax, ay, bx, by));

/** Move `current` toward `target` by at most `maxDelta`. */
export const approach = (current: number, target: number, maxDelta: number): number =>
  current < target
    ? Math.min(current + maxDelta, target)
    : Math.max(current - maxDelta, target);

/** Angle wrapping to (-PI, PI]. */
export const wrapAngle = (a: number): number => {
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
};

export interface AABB {
  x: number; // center x
  y: number; // center y
  w: number; // half width
  h: number; // half height
}

export const aabbOverlap = (a: AABB, b: AABB): boolean =>
  Math.abs(a.x - b.x) < a.w + b.w && Math.abs(a.y - b.y) < a.h + b.h;

export const pointInAABB = (px: number, py: number, b: AABB): boolean =>
  Math.abs(px - b.x) < b.w && Math.abs(py - b.y) < b.h;

/** Integer floor-division that is correct for negatives (for chunk coords). */
export const floorDiv = (a: number, b: number): number => Math.floor(a / b);

/** Positive modulo (for local tile coords inside a chunk). */
export const posMod = (a: number, b: number): number => ((a % b) + b) % b;
