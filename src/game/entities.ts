/**
 * Entity model: flat records with hot fields inline (ECS-lite — see
 * ARCHITECTURE.md §1). Systems are pure functions over the entity array.
 */

export type EntityKind = 'player' | 'enemy' | 'npc' | 'projectile' | 'drop' | 'minion' | 'particleEmitter';

export interface StatusInstance {
  key: string;
  t: number; // seconds remaining
}

export interface Entity {
  id: number;
  kind: EntityKind;
  /** Center position in tile units (floats). */
  x: number;
  y: number;
  /** Previous-step position for render interpolation. */
  px: number;
  py: number;
  vx: number;
  vy: number;
  /** Half extents in tiles. */
  w: number;
  h: number;
  facing: 1 | -1;
  onGround: boolean;
  /** 0 none, 1 water, 2 lava (liquid at body center). */
  inLiquid: number;
  hp: number;
  maxHp: number;
  iframes: number;
  dead: boolean;
  /** Skip tile collision (floaters, ghosts). */
  noclip: boolean;
  gravityMult: number;
  statuses: StatusInstance[];
  /** Per-kind payload (enemy AI state, drop item, projectile spec…). */
  data: any;
}

let nextId = 1;

export function makeEntity(kind: EntityKind, x: number, y: number, w: number, h: number): Entity {
  return {
    id: nextId++,
    kind,
    x,
    y,
    px: x,
    py: y,
    vx: 0,
    vy: 0,
    w,
    h,
    facing: 1,
    onGround: false,
    inLiquid: 0,
    hp: 1,
    maxHp: 1,
    iframes: 0,
    dead: false,
    noclip: false,
    gravityMult: 1,
    statuses: [],
    data: {},
  };
}

/** Swap-remove all dead entities (order not preserved — nothing relies on it). */
export function sweepDead(entities: Entity[]): void {
  for (let i = entities.length - 1; i >= 0; i--) {
    if (entities[i].dead) {
      entities[i] = entities[entities.length - 1];
      entities.pop();
    }
  }
}

export function entitiesInRadius(entities: Entity[], x: number, y: number, r: number, kind?: EntityKind): Entity[] {
  const out: Entity[] = [];
  const r2 = r * r;
  for (const e of entities) {
    if (e.dead) continue;
    if (kind && e.kind !== kind) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy <= r2) out.push(e);
  }
  return out;
}

export function overlaps(a: Entity, b: Entity): boolean {
  return Math.abs(a.x - b.x) < a.w + b.w && Math.abs(a.y - b.y) < a.h + b.h;
}
