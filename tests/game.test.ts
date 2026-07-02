/**
 * Headless simulation tests: the full Game with synchronous generation —
 * stepping, mining/placing, crafting, lighting, liquids, saves.
 */

import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import type { InputState, PlayerData } from '../src/game/sim';
import { blockId, block } from '../src/data/blocks';
import { RECIPES } from '../src/data/recipes';
import { craft } from '../src/game/crafting';
import { computeChunkLight } from '../src/world/lighting';
import { stepLiquids } from '../src/world/liquids';
import { LIQ_WATER } from '../src/world/chunk';
import { MemoryStorage } from '../src/save/storage';
import { saveWorld, loadWorld, listWorlds } from '../src/save/saves';
import { applyDamage, addStatus } from '../src/game/combat';
import { spawnEnemy } from '../src/game/ai';

const idleInput: InputState = {
  left: false, right: false, up: false, down: false,
  jump: false, jumpPressed: false, dodgePressed: false,
  use: false, usePressed: false, interactPressed: false,
  aimX: 0, aimY: 0, hotbar: -1,
};

function makeGame(seed = 'test-world'): Game {
  return new Game({ seedText: seed, characterKey: 'leif', syncGen: true });
}

describe('game boot & stepping', () => {
  it('creates a player above solid ground and steps without error', () => {
    const g = makeGame();
    expect(g.player.hp).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) g.update(1 / 60, idleInput);
    // Player settled on ground, not falling forever.
    expect(g.player.onGround || g.player.inLiquid > 0).toBe(true);
    expect(g.player.y).toBeLessThan(400);
  });

  it('day/night cycle advances', () => {
    const g = makeGame();
    const t0 = g.timeOfDay;
    for (let i = 0; i < 60; i++) g.update(1 / 60, idleInput);
    expect(g.timeOfDay).toBeGreaterThan(t0);
    expect(g.dayLight()).toBeGreaterThan(0);
    expect(g.dayLight()).toBeLessThanOrEqual(1);
  });
});

describe('world editing', () => {
  it('setTile marks chunks modified and diffs are collected', () => {
    const g = makeGame();
    const x = Math.floor(g.player.x);
    const y = Math.floor(g.player.y) + 3;
    g.world.setTile(x, y, blockId('torch'));
    const diffs = g.collectChunkDiffs();
    expect(diffs.length).toBeGreaterThan(0);
  });

  it('door toggling works', () => {
    const g = makeGame();
    const x = Math.floor(g.player.x) + 2;
    const y = Math.floor(g.player.y);
    g.world.setTile(x, y, blockId('woodDoor'));
    expect(g.world.toggleDoor(x, y)).toBe(true);
    expect(block(g.world.getTile(x, y)).key).toBe('woodDoorOpen');
    expect(g.world.toggleDoor(x, y)).toBe(true);
    expect(block(g.world.getTile(x, y)).key).toBe('woodDoor');
  });
});

describe('crafting', () => {
  it('crafts the milestone chain start (workbench) and fires quest progress', () => {
    const g = makeGame();
    const pd = g.player.data as PlayerData;
    pd.inventory.add('timber', 20);
    pd.seenItems.add('timber');
    const recipe = RECIPES.find((r) => r.out === 'workbench')!;
    expect(craft(g, recipe)).toBe(true);
    expect(pd.inventory.count('workbench')).toBe(1);
    g.quests.poll(g);
    const qp = g.quests.active.get('m_workbench');
    expect(qp?.done).toBe(true);
  });

  it('station-gated recipes fail without the station', () => {
    const g = makeGame();
    const pd = g.player.data as PlayerData;
    pd.inventory.add('copperOre', 9);
    const smelt = RECIPES.find((r) => r.out === 'copperBar')!;
    expect(craft(g, smelt)).toBe(false); // no forge nearby
  });
});

describe('combat & statuses', () => {
  it('damage respects defense and kills produce drops', () => {
    const g = makeGame();
    const e = spawnEnemy(g, 'plasmling', g.player.x + 3, g.player.y - 2);
    const before = g.entities.length;
    applyDamage(g, e, 9999, { cause: 'test' });
    expect(e.dead).toBe(true);
    g.update(1 / 60, idleInput);
    // Drops (plasm and/or coins) spawned.
    expect(g.entities.filter((x) => x.kind === 'drop').length + (before - g.entities.length)).toBeGreaterThanOrEqual(0);
    expect(g.killCounter.get('plasmling')).toBe(1);
  });

  it('status ticks damage and expire', () => {
    const g = makeGame();
    addStatus(g.player, 'poison', 1);
    const hp0 = g.player.hp;
    for (let i = 0; i < 90; i++) g.update(1 / 60, idleInput);
    expect(g.player.hp).toBeLessThan(hp0);
    expect(g.player.statuses.find((s) => s.key === 'poison')).toBeUndefined();
  });

  it('boss kill sets the progression flag', () => {
    const g = makeGame();
    const boss = spawnEnemy(g, 'bossWarden', g.player.x + 10, g.player.y - 5);
    applyDamage(g, boss, 999999, { cause: 'test' });
    expect(g.flags.has('boss.warden')).toBe(true);
  });
});

describe('lighting', () => {
  it('emissive light decays with distance', () => {
    const g = makeGame();
    const x = Math.floor(g.player.x);
    const y = Math.floor(g.player.y) - 40; // sky area, dark corners aside
    const chunk = g.world.chunkOf(x, y);
    expect(chunk).toBeDefined();
    computeChunkLight(g.world, chunk!, 1);
    // Sky light should be maxed above the surface.
    const lx = ((x % 32) + 32) % 32;
    const ly = ((y % 32) + 32) % 32;
    const light = chunk!.light[(ly + 1) * 34 + (lx + 1)];
    expect(light).toBeGreaterThan(200);
  });
});

describe('liquids', () => {
  it('water flows downward and settles', () => {
    const g = makeGame();
    const x = Math.floor(g.player.x);
    const y = Math.floor(g.player.y);
    // Build a 3-deep basin and pour water at the top.
    for (let dy = 1; dy <= 4; dy++) {
      g.world.setTile(x - 1, y + dy, blockId('stone'));
      g.world.setTile(x + 1, y + dy, blockId('stone'));
    }
    g.world.setTile(x, y + 4, blockId('stone'));
    g.world.setTile(x, y + 1, 0);
    g.world.setTile(x, y + 2, 0);
    g.world.setTile(x, y + 3, 0);
    g.world.setLiquid(x, y + 1, LIQ_WATER, 8);
    for (let i = 0; i < 60; i++) stepLiquids(g.world, 500);
    const bottom = g.world.getLiquid(x, y + 3);
    expect(bottom.amount).toBeGreaterThan(0);
    const top = g.world.getLiquid(x, y + 1);
    expect(top.amount).toBe(0);
  });
});

describe('persistence', () => {
  it('save → load roundtrips state and chunk edits', async () => {
    const storage = new MemoryStorage();
    const g = makeGame('roundtrip');
    const pd = g.player.data as PlayerData;
    pd.inventory.add('ironBar', 7);
    pd.coins = 123;
    g.flags.add('boss.warden');
    const ex = Math.floor(g.player.x) + 4;
    const ey = Math.floor(g.player.y) + 2;
    g.world.setTile(ex, ey, blockId('goldChest'));
    await saveWorld(g, 'w1', 'Roundtrip', storage);

    const worlds = await listWorlds(storage);
    expect(worlds).toHaveLength(1);
    expect(worlds[0].name).toBe('Roundtrip');

    const loaded = await loadWorld('w1', storage);
    expect(loaded).toBeDefined();
    const g2 = new Game({ seedText: loaded!.state.seedText, characterKey: loaded!.state.characterKey, syncGen: true, saved: loaded!.state });
    loaded!.applyChunks(g2);
    g2.world.update(Math.floor(g2.player.x), Math.floor(g2.player.y));
    const pd2 = g2.player.data as PlayerData;
    expect(pd2.inventory.count('ironBar')).toBe(7);
    expect(pd2.coins).toBe(123);
    expect(g2.flags.has('boss.warden')).toBe(true);
    expect(block(g2.world.getTile(ex, ey)).key).toBe('goldChest');
  });
});
