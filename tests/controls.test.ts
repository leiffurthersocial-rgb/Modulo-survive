/** Control ergonomics: forgiving block targeting + combat aim assist. */

import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import type { InputState, PlayerData } from '../src/game/sim';
import { block, blockId } from '../src/data/blocks';
import { spawnEnemy } from '../src/game/ai';

function inp(over: Partial<InputState>): InputState {
  return {
    left: false, right: false, up: false, down: false,
    jump: false, jumpPressed: false, dodgePressed: false,
    use: false, usePressed: false, interactPressed: false,
    aimX: 0, aimY: 0, hotbar: -1, ...over,
  };
}

function makeGame(): Game {
  return new Game({ seedText: 'controls', characterKey: 'leonidas', syncGen: true });
}

function settle(g: Game): void {
  for (let i = 0; i < 60; i++) g.update(1 / 60, inp({}));
}

describe('forgiving mining', () => {
  it('snaps to a nearby block when the aim tile is empty', () => {
    const g = makeGame();
    const pd = g.player.data as PlayerData;
    settle(g);
    const bx = Math.floor(g.player.x) + 2;
    const by = Math.floor(g.player.y);
    // Carve a pocket, leave a single stone block to target.
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) g.world.setTile(bx + dx, by + dy, 0);
    g.world.setTile(bx, by, blockId('stone'));
    pd.hotbarIndex = pd.inventory.slots.findIndex((s) => s?.key === 'woodPick');

    // Aim at the EMPTY tile beside the block; targeting should still grab it.
    const aimX = bx + 1.5;
    const aimY = by + 0.5;
    for (let i = 0; i < 300; i++) g.update(1 / 60, inp({ use: true, aimX, aimY }));
    expect(block(g.world.getTile(bx, by)).key).not.toBe('stone');
  });

  it('exposes the resolved target tile for the reticle', () => {
    const g = makeGame();
    const pd = g.player.data as PlayerData;
    settle(g);
    const bx = Math.floor(g.player.x) + 2;
    const by = Math.floor(g.player.y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) g.world.setTile(bx + dx, by + dy, 0);
    g.world.setTile(bx, by, blockId('stone'));
    pd.hotbarIndex = pd.inventory.slots.findIndex((s) => s?.key === 'woodPick');
    g.update(1 / 60, inp({ aimX: bx + 1.5, aimY: by + 0.5 }));
    expect(pd.targetX).toBe(bx);
    expect(pd.targetY).toBe(by);
  });
});

describe('combat aim assist', () => {
  it('melee lands on an enemy that is off the aim axis', () => {
    const g = makeGame();
    const pd = g.player.data as PlayerData;
    settle(g);
    pd.hotbarIndex = pd.inventory.slots.findIndex((s) => s?.key === 'woodSword');
    // Enemy up-and-to-the-right; the player aims straight right.
    const e = spawnEnemy(g, 'plasmling', g.player.x + 1.6, g.player.y - 1.4);
    e.iframes = 0;
    const hp0 = e.hp;
    g.update(1 / 60, inp({ use: true, aimX: g.player.x + 5, aimY: g.player.y }));
    expect(e.hp).toBeLessThan(hp0);
  });

  it('holding the button auto-attacks repeatedly', () => {
    const g = makeGame();
    const pd = g.player.data as PlayerData;
    settle(g);
    pd.hotbarIndex = pd.inventory.slots.findIndex((s) => s?.key === 'woodSword');
    // Count swings via the melee sound cue; holding use (never re-pressing)
    // should produce several swings over two seconds.
    let swings = 0;
    g.bus.on('sound', ({ key }) => {
      if (key === 'hit' || key === 'swing') swings++;
    });
    for (let i = 0; i < 150; i++) {
      g.update(1 / 60, inp({ use: true, aimX: g.player.x + 5, aimY: g.player.y }));
    }
    expect(swings).toBeGreaterThan(2);
  });
});
