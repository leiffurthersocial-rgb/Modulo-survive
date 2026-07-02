/**
 * Tile physics: axis-separated AABB sweeps against the tile grid with one-way
 * platforms, liquids, climbables and fall-impact reporting. Shared by every
 * entity kind.
 */

import { GRAVITY, MAX_FALL, WORLD_H } from '../data/constants';
import { block } from '../data/blocks';
import type { World } from '../world/world';
import type { Entity } from './entities';

const EPS = 0.001;

export interface MoveResult {
  hitGround: boolean;
  hitCeiling: boolean;
  hitWall: boolean;
  /** Downward speed at the moment of landing (fall damage). */
  impact: number;
}

function isBlockedAt(world: World, e: Entity, x: number, y: number, movingDown: boolean, dropThrough: boolean): boolean {
  const x0 = Math.floor(x - e.w + EPS);
  const x1 = Math.floor(x + e.w - EPS);
  const y0 = Math.floor(y - e.h + EPS);
  const y1 = Math.floor(y + e.h - EPS);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const id = world.getTile(tx, ty);
      if (id === 0) {
        if (!world.isLoaded(tx, ty)) return true; // unloaded chunks act solid
        continue;
      }
      const def = block(id);
      if (def.solid) return true;
      if (
        def.platform &&
        movingDown &&
        !dropThrough &&
        // Feet must have been above the platform's top edge before the move.
        e.y + e.h - EPS <= ty &&
        y + e.h > ty
      ) {
        return true;
      }
    }
  }
  return false;
}

export function moveEntity(world: World, e: Entity, dt: number): MoveResult {
  const res: MoveResult = { hitGround: false, hitCeiling: false, hitWall: false, impact: 0 };
  const dropThrough = !!e.data.dropThrough;

  if (e.noclip) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.y = Math.min(Math.max(e.y, e.h), WORLD_H - e.h);
    updateLiquidState(world, e);
    return res;
  }

  // --- Horizontal sweep (sub-stepped so fast entities cannot tunnel) ---
  let dx = e.vx * dt;
  const stepX = Math.sign(dx) * Math.min(Math.abs(dx), 0.4);
  while (dx !== 0) {
    const step = Math.abs(dx) > 0.4 ? stepX : dx;
    dx -= step;
    const nx = e.x + step;
    if (isBlockedAt(world, e, nx, e.y, false, dropThrough)) {
      // Auto-step: try a 1-tile step up when on ground (slopes/stairs feel).
      if (e.onGround && !isBlockedAt(world, e, nx, e.y - 1.05, false, dropThrough) && e.data.canStep) {
        e.y -= 1.05;
        e.x = nx;
        continue;
      }
      e.vx = 0;
      res.hitWall = true;
      break;
    }
    e.x = nx;
  }

  // --- Vertical sweep ---
  let dy = e.vy * dt;
  const stepYsize = 0.4;
  const wasFalling = e.vy;
  e.onGround = false;
  while (dy !== 0) {
    const step = Math.sign(dy) * Math.min(Math.abs(dy), stepYsize);
    dy -= step;
    const ny = e.y + step;
    if (isBlockedAt(world, e, e.x, ny, step > 0, dropThrough)) {
      if (step > 0) {
        res.hitGround = true;
        res.impact = wasFalling;
        e.onGround = true;
        // Snap feet to the tile boundary.
        e.y = Math.floor(e.y + e.h + step + EPS) - e.h - EPS;
      } else {
        res.hitCeiling = true;
        e.y = Math.floor(e.y - e.h + step) + 1 + e.h + EPS;
      }
      e.vy = 0;
      break;
    }
    e.y = ny;
  }

  // World bounds.
  if (e.y > WORLD_H - e.h) {
    e.y = WORLD_H - e.h;
    e.vy = 0;
    e.onGround = true;
  }
  if (e.y < e.h) {
    e.y = e.h;
    if (e.vy < 0) e.vy = 0;
  }

  updateLiquidState(world, e);
  return res;
}

export function updateLiquidState(world: World, e: Entity): void {
  const liq = world.getLiquid(Math.floor(e.x), Math.floor(e.y));
  e.inLiquid = liq.amount >= 3 ? liq.type : 0;
}

/** Standard gravity integration with liquid drag and terminal velocity. */
export function applyGravity(e: Entity, dt: number): void {
  const inWater = e.inLiquid > 0;
  const g = GRAVITY * e.gravityMult * (inWater ? 0.35 : 1);
  e.vy += g * dt;
  const cap = inWater ? MAX_FALL * 0.28 : MAX_FALL;
  if (e.vy > cap) e.vy = cap;
}

/** Is the entity standing on (or inside reach of) a climbable tile? */
export function touchingClimbable(world: World, e: Entity): boolean {
  const id = world.getTile(Math.floor(e.x), Math.floor(e.y));
  const id2 = world.getTile(Math.floor(e.x), Math.floor(e.y - e.h * 0.5));
  return (id !== 0 && !!block(id).climbable) || (id2 !== 0 && !!block(id2).climbable);
}

/** Hazard tiles (spikes, cacti, webs) overlapped by the entity. */
export function hazardAt(world: World, e: Entity): { dmg: number; slow: number } {
  let dmg = 0;
  let slow = 1;
  const x0 = Math.floor(e.x - e.w + EPS);
  const x1 = Math.floor(e.x + e.w - EPS);
  const y0 = Math.floor(e.y - e.h + EPS);
  const y1 = Math.floor(e.y + e.h - EPS);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const id = world.getTile(tx, ty);
      if (id === 0) continue;
      const hz = block(id).hazard;
      if (!hz) continue;
      if (hz.dmg) dmg = Math.max(dmg, hz.dmg);
      if (hz.slow) slow = Math.min(slow, 1 - hz.slow);
    }
  }
  return { dmg, slow };
}
