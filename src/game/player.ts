/**
 * Player: movement (run/jump/climb/swim/dodge), survival vitals, mining,
 * building, weapon use, consumables and interaction. Reads InputState only —
 * never the DOM (the input layer produces intents; see NETWORKING.md).
 */

import { BASE_HP, BASE_MANA, BASE_STAMINA, FALL_HURT_SPEED, REACH_TILES } from '../data/constants';
import { AIR, block, blockByKey, blockId, blockIdOpt } from '../data/blocks';
import { itemByKey } from '../data/items';
import { statusByKey } from '../data/status';
import type { AccessoryEffect, CharacterDef } from '../data/types';
import { clamp, wrapAngle } from '../core/math';
import { makeEntity, type Entity } from './entities';
import { Inventory } from './inventory';
import { addStatus, applyDamage, hasStatus, spawnDrop, statusMult, BASE_CRIT } from './combat';
import { applyGravity, hazardAt, moveEntity, touchingClimbable } from './physics';
import { spawnProjectile } from './projectiles';
import { spawnEnemy, lineOfSight } from './ai';
import { tryActivatePortal } from './portals';
import type { InputState, PlayerData, Sim } from './sim';
import { INV_SLOTS, ARMOR_SLOTS, ACCESSORY_SLOTS } from '../data/constants';

const MOVE_SPEED = 8.5;
const ACCEL = 60;
const JUMP_V = 14.5;
const CLIMB_SPEED = 5;
const DODGE_SPEED = 18;

export function createPlayer(character: CharacterDef, x: number, y: number): Entity {
  const e = makeEntity('player', x, y, 0.38, 0.42 * character.appearance.height + 0.44);
  const maxHp = Math.round(BASE_HP * (character.bonuses.maxHp ?? 1));
  e.hp = maxHp;
  e.maxHp = maxHp;
  const pd: PlayerData = {
    character,
    inventory: new Inventory(INV_SLOTS),
    armor: new Inventory(ARMOR_SLOTS),
    accessories: new Inventory(ACCESSORY_SLOTS),
    hotbarIndex: 0,
    mana: BASE_MANA,
    maxMana: BASE_MANA,
    stamina: BASE_STAMINA,
    maxStamina: BASE_STAMINA,
    hunger: 100,
    breath: 100,
    temperature: 18,
    useCooldown: 0,
    swingT: 0,
    swingAngle: 0,
    dodgeT: 0,
    dodgeCd: 0,
    mineX: -1,
    mineY: -1,
    mineProgress: 0,
    targetX: -999,
    targetY: -999,
    respawnX: x,
    respawnY: y,
    respawnT: 0,
    seenItems: new Set(),
    minionCount: 0,
    placedCount: 0,
    coins: 0,
    canStep: true,
    dropThrough: false,
  };
  e.data = pd;
  // Starter kit: everyone gets basic tools; traits add extras.
  pd.inventory.add('woodPick', 1);
  pd.inventory.add('woodAxe', 1);
  pd.inventory.add('woodSword', 1);
  pd.inventory.add('torch', 10);
  for (const [k, n] of character.startItems) {
    if (k === 'coin') pd.coins += n;
    else pd.inventory.add(k, n);
  }
  for (const s of pd.inventory.slots) if (s) pd.seenItems.add(s.key);
  return e;
}

export function accessoryTotal(pd: PlayerData, effect: AccessoryEffect): number {
  let total = 0;
  for (const s of pd.accessories.slots) {
    if (!s) continue;
    const acc = itemByKey(s.key).accessory;
    if (acc?.effect === effect) total += acc.magnitude;
  }
  return total;
}

export function updatePlayer(sim: Sim, input: InputState, dt: number): void {
  const p = sim.player;
  const pd = p.data as PlayerData;

  if (pd.respawnT > 0) {
    pd.respawnT -= dt;
    if (pd.respawnT <= 0) respawn(sim);
    return;
  }

  if (input.hotbar >= 0) pd.hotbarIndex = input.hotbar;

  // ------------------------------------------------------------------ movement
  const speedMult =
    (sim.bonus('moveSpeed')) *
    statusMult(p, 'speedMult') *
    (1 + accessoryTotal(pd, 'moveSpeed')) *
    hazardAt(sim.world, p).slow;
  const target = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  if (target !== 0) p.facing = target as 1 | -1;

  const climbing = touchingClimbable(sim.world, p) && (input.up || input.down) && p.inLiquid === 0;
  const dodging = pd.dodgeT > 0;

  if (dodging) {
    pd.dodgeT -= dt;
    p.vx = p.facing * DODGE_SPEED;
    p.vy = 0;
    p.iframes = Math.max(p.iframes, 0.1);
  } else if (climbing && pd.stamina > 1) {
    p.vx = target * MOVE_SPEED * 0.4 * speedMult;
    p.vy = (input.up ? -CLIMB_SPEED : 0) + (input.down ? CLIMB_SPEED : 0);
    pd.stamina = Math.max(0, pd.stamina - 4 * dt);
  } else if (p.inLiquid > 0) {
    p.vx += (target * MOVE_SPEED * 0.55 * speedMult - p.vx) * Math.min(1, dt * 6);
    if (input.jump || input.up) p.vy -= 40 * dt;
    if (input.down) p.vy += 20 * dt;
    applyGravity(p, dt);
  } else {
    p.vx += clamp(target * MOVE_SPEED * speedMult - p.vx, -ACCEL * dt, ACCEL * dt);
    // Explorer wall grip: slide slowly + jump off walls.
    const wallGrip =
      (sim.bonus('climb')) > 0 &&
      !p.onGround &&
      target !== 0 &&
      sim.world.isSolid(Math.floor(p.x + target * (p.w + 0.15)), Math.floor(p.y));
    if (wallGrip && p.vy > 2) p.vy = 2;
    if (input.jumpPressed && (p.onGround || p.data.coyote > 0 || wallGrip)) {
      const jumpBoost = 1 + accessoryTotal(pd, 'jumpBoost');
      p.vy = -JUMP_V * Math.sqrt(jumpBoost);
      if (wallGrip && !p.onGround) p.vx = -target * MOVE_SPEED * 0.9;
      p.data.coyote = 0;
      sim.bus.emit('sound', { key: 'jump', x: p.x, y: p.y });
    }
    applyGravity(p, dt);
    // Short-hop: releasing jump cuts ascent.
    if (!input.jump && p.vy < -4) p.vy += 30 * dt;
  }

  // Dodge roll.
  pd.dodgeCd -= dt;
  if (input.dodgePressed && pd.dodgeCd <= 0 && pd.stamina >= 30 && !dodging) {
    pd.dodgeT = 0.24;
    pd.dodgeCd = 0.8;
    pd.stamina -= 30;
    p.iframes = Math.max(p.iframes, 0.3);
    sim.bus.emit('sound', { key: 'dodge', x: p.x, y: p.y });
  }

  pd.dropThrough = input.down && input.jumpPressed;
  p.data.dropThrough = pd.dropThrough;
  p.data.canStep = true;

  const wasOnGround = p.onGround;
  const res = moveEntity(sim.world, p, dt);
  p.data.coyote = p.onGround ? 0.12 : Math.max(0, (p.data.coyote ?? 0) - dt);

  // Fall damage.
  if (res.hitGround && !wasOnGround && res.impact > FALL_HURT_SPEED && p.inLiquid === 0) {
    const feather = accessoryTotal(pd, 'featherfall') > 0 || hasStatus(p, 'featherfall');
    if (!feather) {
      applyDamage(sim, p, Math.round((res.impact - FALL_HURT_SPEED) * 5), { dot: true, cause: 'fall' });
      sim.bus.emit('screenShake', { amount: 3 });
      sim.bus.emit('sound', { key: 'thud', x: p.x, y: p.y });
    }
  }

  updateVitals(sim, p, pd, dt);

  // ------------------------------------------------------------------ actions
  pd.useCooldown -= dt;
  if (pd.swingT > 0) pd.swingT -= dt;

  // Highlight the block/tile currently targeted (drives the reticle).
  updateTargetTile(sim, input);

  if (input.interactPressed) interact(sim, input);
  // Holding the primary button auto-repeats: continuous mining, and auto-attack
  // for weapons (the swing/shot rate is gated by useCooldown).
  if (input.use && pd.useCooldown <= 0) useSelected(sim, input, dt);
  else if (!input.use) {
    pd.mineProgress = 0;
    pd.mineX = -1;
  }

  if (p.hp <= 0 && pd.respawnT <= 0) {
    startDeath(sim);
  }
}

// ---------------------------------------------------------------------------
// Vitals: stamina, mana, hunger, breath, temperature
// ---------------------------------------------------------------------------

function updateVitals(sim: Sim, p: Entity, pd: PlayerData, dt: number): void {
  const staminaRegen = 16 * (1 + accessoryTotal(pd, 'staminaRegen')) * statusMult(p, 'staminaMult');
  pd.stamina = clamp(pd.stamina + staminaRegen * dt, 0, pd.maxStamina);
  pd.maxMana = BASE_MANA + accessoryTotal(pd, 'manaMax');
  pd.mana = clamp(pd.mana + 6 * dt, 0, pd.maxMana);

  // Hunger: slow drain; blocks regen when low, hurts when empty.
  pd.hunger = Math.max(0, pd.hunger - 0.09 * dt);
  if (pd.hunger > 30 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 0.8 * dt);
  if (pd.hunger <= 5) {
    p.data._starve = (p.data._starve ?? 0) + dt;
    if (p.data._starve > 2) {
      p.data._starve = 0;
      applyDamage(sim, p, 3, { dot: true, cause: 'starvation' });
    }
  }

  // Breath.
  const headLiquid = sim.world.getLiquid(Math.floor(p.x), Math.floor(p.y - p.h * 0.6));
  const submerged = headLiquid.amount >= 6;
  const gills = accessoryTotal(pd, 'gills') > 0 || hasStatus(p, 'gills');
  if (submerged && !gills) {
    pd.breath = Math.max(0, pd.breath - 12 * dt);
    if (pd.breath <= 0) {
      p.data._drown = (p.data._drown ?? 0) + dt;
      if (p.data._drown > 0.8) {
        p.data._drown = 0;
        applyDamage(sim, p, 8, { dot: true, cause: 'drowning' });
      }
    }
  } else {
    pd.breath = Math.min(100, pd.breath + 40 * dt);
  }

  // Lava contact burns.
  if (p.inLiquid === 2) {
    addStatus(p, 'burning', 2);
    applyDamage(sim, p, 10 * dt + 1, { dot: true, cause: 'lava' });
  }

  // Hazard tiles.
  const hz = hazardAt(sim.world, p);
  if (hz.dmg > 0 && p.iframes <= 0) {
    applyDamage(sim, p, hz.dmg, { knockY: -6, cause: 'hazard' });
  }

  // Temperature: environment → body drift → extreme statuses.
  let env = envTemperature(sim, p);
  env += accessoryTotal(pd, 'warmth') * 2 - accessoryTotal(pd, 'cooling') * 2;
  for (const s of pd.armor.slots) if (s) env += itemByKey(s.key).armor?.warmth ?? 0;
  for (const st of p.statuses) env += statusByKey(st.key).tempShift ?? 0;
  pd.temperature += (env - pd.temperature) * Math.min(1, dt * 0.08);
  if (pd.temperature < -10) addStatus(p, 'hypothermia', 1.5);
  else if (pd.temperature > 46) addStatus(p, 'heatstroke', 1.5);
}

export function envTemperature(sim: Sim, p: Entity): number {
  const dimAmbient = sim.world.dim.ambient;
  let env = dimAmbient;
  // Depth: caves are cool, the deep is hot.
  const depth = p.y - sim.surfaceAt(Math.floor(p.x));
  if (depth > 20) env = env * 0.5 + 8 + Math.max(0, (p.y - 380) * 0.25);
  if (sim.isNight()) env -= 7;
  if (sim.weather === 'snow') env -= 9;
  else if (sim.weather === 'rain' || sim.weather === 'storm') env -= 4;
  // Nearby heat sources.
  let heat = 0;
  const px = Math.floor(p.x);
  const py = Math.floor(p.y);
  for (let dx = -5; dx <= 5 && heat === 0; dx++) {
    for (let dy = -4; dy <= 4; dy++) {
      const id = sim.world.getTile(px + dx, py + dy);
      if (id === 0) continue;
      const key = block(id).key;
      if (key === 'campfire' || key === 'forge') {
        heat = 16;
        break;
      }
      if (key === 'torch' && heat < 5) heat = 5;
    }
  }
  return env + heat;
}

// ---------------------------------------------------------------------------
// Using the selected item
// ---------------------------------------------------------------------------

function selected(pd: PlayerData): { key: string; count: number } | null {
  return pd.inventory.get(pd.hotbarIndex);
}

function aimClamped(sim: Sim, input: InputState): { x: number; y: number; ang: number } {
  const p = sim.player;
  const dx = input.aimX - p.x;
  const dy = input.aimY - p.y;
  const dist = Math.hypot(dx, dy) || 1;
  const r = Math.min(dist, REACH_TILES);
  return { x: p.x + (dx / dist) * r, y: p.y + (dy / dist) * r, ang: Math.atan2(dy, dx) };
}

/** True if a tile's center is within reach of the player. */
function tileInReach(sim: Sim, tx: number, ty: number): boolean {
  const p = sim.player;
  const ddx = tx + 0.5 - p.x;
  const ddy = ty + 0.5 - p.y;
  return ddx * ddx + ddy * ddy <= (REACH_TILES + 0.6) * (REACH_TILES + 0.6);
}

/**
 * Forgiving mine targeting: pick the block the player is pointing at, snapped
 * into reach. If the exact aim tile is empty, grab the nearest actual block
 * near the aim that is in range — so rough aiming (especially on touch) still
 * selects a real block. `wall` targets the background-wall layer (hammer).
 */
function resolveMineTarget(sim: Sim, input: InputState, wall: boolean): { tx: number; ty: number } | null {
  const p = sim.player;
  const dx = input.aimX - p.x;
  const dy = input.aimY - p.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const r = Math.min(dist, REACH_TILES);
  const ax = p.x + (dx / dist) * r;
  const ay = p.y + (dy / dist) * r;
  const cx = Math.floor(ax);
  const cy = Math.floor(ay);
  const get = (x: number, y: number) => (wall ? sim.world.getWall(x, y) : sim.world.getTile(x, y));

  // The exact aim tile wins when it holds a block in range.
  if (get(cx, cy) !== AIR && tileInReach(sim, cx, cy)) return { tx: cx, ty: cy };

  // Otherwise snap to the closest block to the aim point, within reach.
  let best: { tx: number; ty: number } | null = null;
  let bestD = Infinity;
  for (let ry = -2; ry <= 2; ry++) {
    for (let rx = -2; rx <= 2; rx++) {
      const x = cx + rx;
      const y = cy + ry;
      if (get(x, y) === AIR || !tileInReach(sim, x, y)) continue;
      const ex = x + 0.5 - ax;
      const ey = y + 0.5 - ay;
      const d = ex * ex + ey * ey;
      if (d < bestD) {
        bestD = d;
        best = { tx: x, ty: y };
      }
    }
  }
  return best;
}

/**
 * Aim assist: bend the firing/swing angle toward the nearest enemy inside a
 * cone of the player's aim. Makes melee and ranged combat land without precise
 * aiming (essential for touch). Returns the base angle when no target fits.
 */
function assistAngle(sim: Sim, baseAng: number, range: number, cone: number, requireLoS: boolean, lead = 0): number {
  const p = sim.player;
  let best: Entity | null = null;
  let bestScore = Infinity;
  for (const e of sim.entities) {
    if (e.kind !== 'enemy' || e.dead || e.data.ownerId) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > range) continue;
    const diff = Math.abs(wrapAngle(Math.atan2(dy, dx) - baseAng));
    if (diff > cone) continue;
    if (requireLoS && !lineOfSight(sim, p.x, p.y - 0.3, e.x, e.y)) continue;
    const score = d + diff * 4; // prefer close, well-aligned targets
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  if (!best) return baseAng;
  return Math.atan2(best.y + best.vy * lead - p.y, best.x + best.vx * lead - p.x);
}

/** Update the reticle target tile (mining/placement) shown by the renderer. */
function updateTargetTile(sim: Sim, input: InputState): void {
  const pd = sim.player.data as PlayerData;
  const slot = selected(pd);
  const item = slot ? itemByKey(slot.key) : null;
  if (!item || item.kind === 'tool') {
    const wall = item?.tool?.type === 'hammer';
    if (item?.tool?.type === 'hoe') {
      const a = aimClamped(sim, input);
      pd.targetX = Math.floor(a.x);
      pd.targetY = Math.floor(a.y);
      return;
    }
    const t = resolveMineTarget(sim, input, wall);
    if (t) {
      pd.targetX = t.tx;
      pd.targetY = t.ty;
    } else {
      pd.targetX = -999;
      pd.targetY = -999;
    }
  } else if (item.kind === 'block' || item.kind === 'wall' || item.kind === 'seed' || item.kind === 'bucket') {
    const a = aimClamped(sim, input);
    pd.targetX = Math.floor(a.x);
    pd.targetY = Math.floor(a.y);
  } else {
    // Weapons/consumables: no tile reticle.
    pd.targetX = -999;
    pd.targetY = -999;
  }
}

function useSelected(sim: Sim, input: InputState, dt: number): void {
  const p = sim.player;
  const pd = p.data as PlayerData;
  const slot = selected(pd);
  if (!slot) {
    // Bare hands: punch-mine soft blocks slowly.
    mine(sim, input, { type: 'any', power: 1, speed: 0.4 }, dt);
    return;
  }
  const item = itemByKey(slot.key);

  switch (item.kind) {
    case 'tool':
      if (item.tool!.type === 'hoe') till(sim, input, pd);
      else mine(sim, input, item.tool!, dt);
      break;
    case 'weapon':
      attack(sim, input, slot.key);
      break;
    case 'block':
    case 'wall':
    case 'seed':
      placeBlock(sim, input, slot.key);
      break;
    case 'consumable':
      consume(sim, slot.key);
      break;
    case 'bucket':
      useBucket(sim, input, slot.key);
      break;
    case 'summon':
      summonBoss(sim, slot.key);
      break;
    default:
      break;
  }
}

// --- Mining ---

function mine(sim: Sim, input: InputState, tool: { type: string; power: number; speed: number }, dt: number): void {
  const pd = sim.player.data as PlayerData;
  const isHammer = tool.type === 'hammer';
  // Smart target: the block under the aim, or the nearest block in reach.
  const target = resolveMineTarget(sim, input, isHammer);
  if (!target) {
    pd.mineProgress = 0;
    pd.mineX = -1;
    return;
  }
  const { tx, ty } = target;
  const id = isHammer ? sim.world.getWall(tx, ty) : sim.world.getTile(tx, ty);
  if (id === AIR) {
    pd.mineProgress = 0;
    return;
  }
  const def = block(id);
  // Tool gating: walls need a hammer; blocks need their listed tool.
  const needed = def.wall ? 'hammer' : (def.tool ?? 'pick');
  if (needed !== 'any' && tool.type !== needed) return;
  if ((def.minPower ?? 0) > tool.power) {
    sim.bus.emit('sound', { key: 'clink', x: tx, y: ty });
    pd.useCooldown = 0.3;
    return;
  }
  if (pd.mineX !== tx || pd.mineY !== ty) {
    pd.mineX = tx;
    pd.mineY = ty;
    pd.mineProgress = 0;
  }
  const mineSpeed = tool.speed * sim.bonus('mineSpeed');
  pd.mineProgress += (mineSpeed / Math.max(0.05, def.hardness)) * dt;
  pd.swingT = 0.2;
  pd.swingAngle = Math.atan2(ty + 0.5 - sim.player.y, tx + 0.5 - sim.player.x);
  sim.player.facing = tx + 0.5 >= sim.player.x ? 1 : -1;
  if (sim.rng.next() < dt * 6) {
    sim.bus.emit('particles', { key: 'mine', x: tx + 0.5, y: ty + 0.5, count: 2, color: def.color });
    sim.bus.emit('sound', { key: def.tool === 'axe' ? 'chop' : 'dig', x: tx, y: ty });
  }
  if (pd.mineProgress >= 1) {
    pd.mineProgress = 0;
    breakTile(sim, tx, ty, isHammer && def.wall === true);
  }
}

export function breakTile(sim: Sim, tx: number, ty: number, wallLayer = false): void {
  const id = wallLayer ? sim.world.getWall(tx, ty) : sim.world.getTile(tx, ty);
  if (id === AIR) return;
  const def = block(id);
  if (wallLayer) sim.world.setWall(tx, ty, AIR);
  else sim.world.setTile(tx, ty, AIR);

  // Drops (resourceYield trait can add extras).
  const dropKey = def.drops === null ? null : (def.drops ?? def.key);
  if (dropKey) {
    let n = 1;
    const yieldBonus = sim.bonus('resourceYield');
    if (yieldBonus > 1 && sim.rng.next() < yieldBonus - 1) n++;
    if (def.crop && def.crop.stage === def.crop.stages - 1) {
      n = sim.rng.int(def.crop.yieldCount[0], def.crop.yieldCount[1]);
      spawnDrop(sim, tx + 0.5, ty + 0.5, def.crop.seed, sim.rng.int(1, 2));
    }
    spawnDrop(sim, tx + 0.5, ty + 0.5, dropKey, n);
  }
  sim.bus.emit('tileBroken', { x: tx, y: ty, blockKey: def.key });
  sim.bus.emit('particles', { key: 'break', x: tx + 0.5, y: ty + 0.5, count: 8, color: def.color });
  sim.bus.emit('sound', { key: 'break', x: tx, y: ty });

  if (!wallLayer) {
    // Cascade: fragile/needsFloor blocks above collapse; chests spill.
    const above = sim.world.getTile(tx, ty - 1);
    if (above !== AIR) {
      const aDef = block(above);
      if (aDef.needsFloor || aDef.fragile) breakTile(sim, tx, ty - 1);
    }
    if (def.furniture === 'chest') spillChest(sim, tx, ty);
    // Felling: chopping a log takes the trunk above and its canopy with it.
    if (def.style === 'log') fellTreeAbove(sim, tx, ty);
  }
}

function fellTreeAbove(sim: Sim, tx: number, ty: number): void {
  let y = ty - 1;
  let logs = 0;
  while (logs < 24) {
    const def = block(sim.world.getTile(tx, y));
    if (def.style !== 'log') break;
    sim.world.setTile(tx, y, AIR);
    spawnDrop(sim, tx + 0.5, y + 0.5, def.key, 1);
    // Clear this segment's canopy.
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 1; dy++) {
        const id = sim.world.getTile(tx + dx, y + dy);
        if (id !== AIR && block(id).style === 'leaf') sim.world.setTile(tx + dx, y + dy, AIR);
      }
    }
    logs++;
    y--;
  }
  if (logs > 0) sim.bus.emit('particles', { key: 'break', x: tx + 0.5, y: y + 1, count: 10, color: 0x4e9c46 });
}

function spillChest(sim: Sim, tx: number, ty: number): void {
  const key = `${tx},${ty}`;
  const inv = sim.world.chests.get(key) as Inventory | undefined;
  if (inv) {
    for (const s of inv.slots) if (s) spawnDrop(sim, tx + 0.5, ty + 0.5, s.key, s.count);
    sim.world.chests.delete(key);
  }
}

// --- Building ---

function placeBlock(sim: Sim, input: InputState, itemKey: string): void {
  const p = sim.player;
  const pd = p.data as PlayerData;
  const item = itemByKey(itemKey);
  if (!item.block) return;
  const def = blockByKey(item.block);
  const aim = aimClamped(sim, input);
  const tx = Math.floor(aim.x);
  const ty = Math.floor(aim.y);
  if (!sim.world.chunkOf(tx, ty)) return;

  if (def.wall || item.kind === 'wall') {
    if (sim.world.getWall(tx, ty) !== AIR || sim.world.getTile(tx, ty) !== AIR) return;
    if (!hasNeighborSupport(sim, tx, ty, true)) return;
    sim.world.setWall(tx, ty, blockId(def.key));
  } else {
    const existing = sim.world.getTile(tx, ty);
    if (existing !== AIR) return;
    // Solid blocks cannot be placed inside entities.
    if (def.solid) {
      for (const e of sim.entities) {
        if (e.dead || e.kind === 'drop' || e.kind === 'projectile') continue;
        if (Math.abs(e.x - (tx + 0.5)) < e.w + 0.5 && Math.abs(e.y - (ty + 0.5)) < e.h + 0.5) return;
      }
      if (Math.abs(p.x - (tx + 0.5)) < p.w + 0.5 && Math.abs(p.y - (ty + 0.5)) < p.h + 0.5) return;
    }
    if (def.needsFloor && !sim.world.isSolid(tx, ty + 1)) return;
    if (item.kind === 'seed' && block(sim.world.getTile(tx, ty + 1)).key !== 'tilledSoil') return;
    if (!def.needsFloor && !hasNeighborSupport(sim, tx, ty, false)) return;
    sim.world.setTile(tx, ty, blockId(def.key));
  }
  pd.inventory.remove(itemKey, 1);
  pd.placedCount++;
  pd.useCooldown = 0.16 / (sim.bonus('buildSpeed'));
  sim.bus.emit('tilePlaced', { x: tx, y: ty, blockKey: def.key });
  sim.bus.emit('sound', { key: 'place', x: tx, y: ty });
}

function hasNeighborSupport(sim: Sim, tx: number, ty: number, forWall: boolean): boolean {
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    const t = sim.world.getTile(tx + dx, ty + dy);
    if (t !== AIR && (block(t).solid || block(t).platform || block(t).climbable)) return true;
    if (sim.world.getWall(tx + dx, ty + dy) !== AIR) return true;
  }
  if (forWall && sim.world.getWall(tx, ty) === AIR) {
    // walls can also anchor to the tile behind them being framed by terrain
    return false;
  }
  return false;
}

// --- Farming ---

function till(sim: Sim, input: InputState, pd: PlayerData): void {
  const aim = aimClamped(sim, input);
  const tx = Math.floor(aim.x);
  const ty = Math.floor(aim.y);
  const id = sim.world.getTile(tx, ty);
  const key = block(id).key;
  if ((key === 'dirt' || key === 'grass' || key === 'jungleGrass' || key === 'snowGrass') && sim.world.getTile(tx, ty - 1) === AIR) {
    sim.world.setTile(tx, ty, blockId('tilledSoil'));
    pd.useCooldown = 0.3;
    sim.bus.emit('sound', { key: 'dig', x: tx, y: ty });
  }
}

// --- Combat ---

function attack(sim: Sim, input: InputState, itemKey: string): void {
  const p = sim.player;
  const pd = p.data as PlayerData;
  const item = itemByKey(itemKey);
  const w = item.weapon!;
  const aim = aimClamped(sim, input);
  pd.useCooldown = 1 / w.speed;
  pd.swingT = Math.min(0.35, 1 / w.speed);
  pd.swingAngle = aim.ang;
  p.facing = Math.cos(aim.ang) >= 0 ? 1 : -1;

  const critChance =
    BASE_CRIT +
    (w.critBonus ?? 0) +
    accessoryTotal(pd, 'critChance') +
    ((sim.bonus('critChance')) > 1 ? sim.bonus('critChance') - 1 : 0);

  switch (w.type) {
    case 'sword':
    case 'spear': {
      const reach = w.type === 'spear' ? 3.4 : 2.4;
      // Aim assist: swing toward the nearest enemy in range so melee lands
      // without precise aiming. Spears keep a tighter arc than swords.
      const swingCone = w.type === 'spear' ? 0.8 : 1.5;
      const attackAng = assistAngle(sim, aim.ang, reach + 1.5, swingCone, false);
      pd.swingAngle = attackAng;
      p.facing = Math.cos(attackAng) >= 0 ? 1 : -1;
      const dmg = Math.round(w.dmg * (sim.bonus('meleeDamage')) * statusMult(p, 'dmgMult'));
      let hitAny = false;
      for (const e of sim.entities) {
        if (e.kind !== 'enemy' || e.dead) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist > reach + e.w) continue;
        // Directional arc around the (assisted) swing angle.
        const diff = Math.abs(wrapAngle(Math.atan2(dy, dx) - attackAng));
        if (diff > swingCone) continue;
        const crit = sim.rng.next() < critChance;
        applyDamage(sim, e, dmg, { crit, knockX: Math.sign(dx) * w.knockback, knockY: -w.knockback * 0.5 });
        hitAny = true;
      }
      sim.bus.emit('sound', { key: hitAny ? 'hit' : 'swing', x: p.x, y: p.y });
      break;
    }
    case 'bow': {
      const ammo = ['emberArrow', 'frostArrow', 'arrow'].find((a) => pd.inventory.count(a) > 0);
      if (!ammo) {
        sim.bus.emit('sound', { key: 'clink', x: p.x, y: p.y });
        return;
      }
      pd.inventory.remove(ammo, 1);
      const dmg = Math.round(w.dmg * (sim.bonus('bowDamage')) * statusMult(p, 'dmgMult'));
      // Flatter, faster arrows + generous aim assist make bows point-and-shoot.
      const spec = {
        look: 'arrow' as const,
        speed: 34,
        gravity: 0.06,
        color: ammo === 'emberArrow' ? 0xff8a50 : ammo === 'frostArrow' ? 0x9ff0ff : 0xd9c27e,
        status: ammo === 'emberArrow' ? { key: 'burning', duration: 3, chance: 0.6 } : ammo === 'frostArrow' ? { key: 'freezing', duration: 2.5, chance: 0.6 } : undefined,
      };
      const fireAng = assistAngle(sim, aim.ang, 34, 0.65, true, 0.15);
      pd.swingAngle = fireAng;
      p.facing = Math.cos(fireAng) >= 0 ? 1 : -1;
      spawnProjectile(sim, true, p.x, p.y - 0.3, fireAng, spec, dmg, { crit: sim.rng.next() < critChance, knockback: w.knockback });
      sim.bus.emit('sound', { key: 'bow', x: p.x, y: p.y });
      break;
    }
    case 'wand': {
      const cost = Math.round((w.mana ?? 8) * (sim.bonus('manaCost')));
      if (pd.mana < cost) {
        sim.bus.emit('sound', { key: 'fizzle', x: p.x, y: p.y });
        return;
      }
      pd.mana -= cost;
      const dmg = Math.round(w.dmg * statusMult(p, 'dmgMult'));
      // Homing bolts already track; still nudge the launch angle toward a target.
      const castAng = assistAngle(sim, aim.ang, 30, 0.7, true, 0.15);
      pd.swingAngle = castAng;
      p.facing = Math.cos(castAng) >= 0 ? 1 : -1;
      spawnProjectile(sim, true, p.x, p.y - 0.3, castAng, w.projectile!, dmg, { crit: sim.rng.next() < critChance, knockback: w.knockback });
      sim.bus.emit('sound', { key: 'cast', x: p.x, y: p.y });
      break;
    }
    case 'summonStaff': {
      const cost = Math.round((w.mana ?? 20) * (sim.bonus('manaCost')));
      if (pd.mana < cost || !w.minion) return;
      pd.mana -= cost;
      // Cap: 2 minions (3 with mana loop equipped).
      const cap = 2 + (accessoryTotal(pd, 'manaMax') > 0 ? 1 : 0);
      const mine = sim.entities.filter((e) => e.kind === 'enemy' && !e.dead && e.data.ownerId === p.id);
      if (mine.length >= cap) mine[0].dead = true;
      const m = spawnEnemy(sim, w.minion, p.x, p.y - 1.5);
      m.data.ownerId = p.id;
      sim.bus.emit('sound', { key: 'summon', x: p.x, y: p.y });
      break;
    }
    case 'thrown': {
      pd.inventory.remove(itemKey, 1);
      spawnProjectile(sim, true, p.x, p.y - 0.3, aim.ang, w.projectile!, w.dmg, { crit: sim.rng.next() < critChance, knockback: w.knockback });
      sim.bus.emit('sound', { key: 'swing', x: p.x, y: p.y });
      break;
    }
  }
}

// --- Consumables ---

function consume(sim: Sim, itemKey: string): void {
  const p = sim.player;
  const pd = p.data as PlayerData;
  const item = itemByKey(itemKey);
  let used = false;
  if (item.food) {
    pd.hunger = Math.min(100, pd.hunger + item.food.hunger);
    for (const b of item.food.buffs ?? []) addStatus(p, b.key, b.duration);
    used = true;
    sim.bus.emit('sound', { key: 'eat', x: p.x, y: p.y });
  } else if (item.potion) {
    if (item.potion.heal) p.hp = Math.min(p.maxHp, p.hp + item.potion.heal);
    if (item.potion.mana) pd.mana = Math.min(pd.maxMana, pd.mana + item.potion.mana);
    for (const eff of item.potion.effects ?? []) addStatus(p, eff.key, eff.duration);
    used = true;
    sim.bus.emit('sound', { key: 'drink', x: p.x, y: p.y });
  }
  if (used) {
    pd.inventory.remove(itemKey, 1);
    pd.useCooldown = 0.5;
  }
}

function useBucket(sim: Sim, input: InputState, itemKey: string): void {
  const pd = sim.player.data as PlayerData;
  const aim = aimClamped(sim, input);
  const tx = Math.floor(aim.x);
  const ty = Math.floor(aim.y);
  pd.useCooldown = 0.4;
  if (itemKey === 'emptyBucket') {
    const liq = sim.world.getLiquid(tx, ty);
    if (liq.amount >= 6) {
      sim.world.setLiquid(tx, ty, 0, 0);
      pd.inventory.remove('emptyBucket', 1);
      pd.inventory.add(liq.type === 2 ? 'lavaBucket' : 'waterBucket', 1);
      sim.bus.emit('sound', { key: 'splash', x: tx, y: ty });
    }
  } else if (sim.world.getTile(tx, ty) === AIR) {
    sim.world.setLiquid(tx, ty, itemKey === 'lavaBucket' ? 2 : 1, 8);
    pd.inventory.remove(itemKey, 1);
    pd.inventory.add('emptyBucket', 1);
    sim.bus.emit('sound', { key: 'splash', x: tx, y: ty });
  }
}

function summonBoss(sim: Sim, itemKey: string): void {
  const p = sim.player;
  const pd = p.data as PlayerData;
  const item = itemByKey(itemKey);
  if (!item.summons) return;
  // Guard: one boss at a time.
  if (sim.entities.some((e) => e.kind === 'enemy' && !e.dead && e.data.defKey && e.data.defKey.startsWith('boss'))) return;
  if (itemKey === 'nullBeacon' && sim.dimKey !== 'void') {
    sim.bus.emit('banner', { title: 'Only the Void answers this call', color: 0x9a7ae8 });
    return;
  }
  pd.inventory.remove(itemKey, 1);
  pd.useCooldown = 1;
  const side = sim.rng.chance(0.5) ? 1 : -1;
  spawnEnemy(sim, item.summons, p.x + side * 14, p.y - 6);
  sim.bus.emit('screenShake', { amount: 6 });
}

// --- Interaction (right-click) ---

function interact(sim: Sim, input: InputState): void {
  const p = sim.player;
  const pd = p.data as PlayerData;
  const aim = aimClamped(sim, input);
  const tx = Math.floor(aim.x);
  const ty = Math.floor(aim.y);

  // NPC first.
  for (const e of sim.entities) {
    if (e.kind !== 'npc' || e.dead) continue;
    if (Math.abs(e.x - aim.x) < 1.2 && Math.abs(e.y - aim.y) < 1.5) {
      sim.bus.emit('dialogue', { npcKey: e.data.defKey, text: '' });
      return;
    }
  }

  const id = sim.world.getTile(tx, ty);
  if (id === AIR) return;
  const def = block(id);
  switch (def.furniture) {
    case 'door':
      sim.world.toggleDoor(tx, ty);
      sim.bus.emit('sound', { key: 'door', x: tx, y: ty });
      return;
    case 'chest':
      sim.bus.emit('openChest', { x: tx, y: ty });
      return;
    case 'bed':
      pd.respawnX = tx + 0.5;
      pd.respawnY = ty - 1;
      sim.bus.emit('banner', { title: 'Respawn point set', color: 0x58b04c });
      return;
    case 'teleport': {
      // Jump to the next anchor in the world.
      const anchors: [number, number][] = sim.world.dim ? findAnchors(sim, tx, ty) : [];
      if (anchors.length > 0) {
        const [ax, ay] = anchors[0];
        p.x = ax + 0.5;
        p.y = ay - 1;
        sim.bus.emit('particles', { key: 'teleport', x: p.x, y: p.y, count: 16, color: 0x8a5fb0 });
        sim.bus.emit('sound', { key: 'teleport', x: p.x, y: p.y });
      }
      return;
    }
    case 'altar':
      if (def.key === 'voidAltar' && sim.dimKey === 'void') summonViaAltar(sim);
      return;
    case 'trophy':
      sim.bus.emit('dialogue', { npcKey: '#tablet', text: loreLine(sim, tx, ty) });
      return;
    default:
      break;
  }
  if (def.portalTo) tryActivatePortal(sim, tx, ty, def.portalTo);
}

function findAnchors(sim: Sim, fromX: number, fromY: number): [number, number][] {
  const anchorId = blockIdOpt('teleportAnchor');
  const out: [number, number][] = [];
  for (const chunk of sim.world.chunks.values()) {
    for (let i = 0; i < chunk.fg.length; i++) {
      if (chunk.fg[i] === anchorId) {
        const x = chunk.cx * 32 + (i % 32);
        const y = chunk.cy * 32 + Math.floor(i / 32);
        if (x !== fromX || y !== fromY) out.push([x, y]);
      }
    }
  }
  return out;
}

function summonViaAltar(sim: Sim): void {
  if (sim.entities.some((e) => e.kind === 'enemy' && !e.dead && e.data.defKey === 'bossNull')) return;
  spawnEnemy(sim, 'bossNull', sim.player.x, sim.player.y - 10);
  sim.bus.emit('screenShake', { amount: 8 });
}

const LORE = [
  'THE LATTICE HELD FOR TEN THOUSAND CYCLES. THEN THE REMAINDER.',
  'WE CUT DOORS BETWEEN CONGRUENT POINTS. THE DOORS CUT BACK.',
  'THE WARDEN DOES NOT SLEEP. IT ROUNDS DOWN.',
  'EIGHT STRATA, ONE KEYSTONE. DO NOT LET THE NINTH ALIGN.',
  'WE BURIED THE FOUNDRIES STILL RUNNING. FORGIVE US.',
  'TIME POOLS IN THE LOW PLACES. DO NOT DRINK IT.',
];

function loreLine(sim: Sim, x: number, y: number): string {
  return LORE[Math.abs(x * 31 + y * 17) % LORE.length];
}

// --- Death & respawn ---

function startDeath(sim: Sim): void {
  const p = sim.player;
  const pd = p.data as PlayerData;
  pd.respawnT = 4;
  // Drop a fifth of carried coins at the death site.
  const lost = Math.floor(pd.coins * 0.2);
  if (lost > 0) {
    pd.coins -= lost;
    spawnDrop(sim, p.x, p.y, 'coin', lost);
  }
  sim.bus.emit('particles', { key: 'death', x: p.x, y: p.y, count: 24, color: 0xd94f4f });
  sim.bus.emit('sound', { key: 'playerDie', x: p.x, y: p.y });
}

function respawn(sim: Sim): void {
  const p = sim.player;
  const pd = p.data as PlayerData;
  p.hp = p.maxHp;
  pd.hunger = Math.max(40, pd.hunger);
  pd.breath = 100;
  p.statuses = [];
  p.vx = 0;
  p.vy = 0;
  p.x = pd.respawnX;
  p.y = pd.respawnY;
  p.iframes = 2;
}
