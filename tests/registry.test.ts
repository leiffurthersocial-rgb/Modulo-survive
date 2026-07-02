/** Referential integrity across all content registries — no dangling keys. */

import { describe, expect, it } from 'vitest';
import { BLOCK_DEFS, BLOCK_COUNT, blockIdOpt } from '../src/data/blocks';
import { ITEM_DEFS, ITEM_COUNT, itemExists } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { ENEMY_DEFS, ENEMY_COUNT, enemyExists } from '../src/data/enemies';
import { CHARACTERS } from '../src/data/characters';
import { NPC_DEFS } from '../src/data/npcs';
import { QUEST_DEFS, questByKey } from '../src/data/quests';
import { BIOME_DEFS, DIMENSION_DEFS, biomeByKey } from '../src/data/dimensions';
import { statusExists } from '../src/data/status';

describe('content scale', () => {
  it('ships substantial content', () => {
    expect(BLOCK_COUNT).toBeGreaterThan(200);
    expect(ITEM_COUNT).toBeGreaterThan(350);
    expect(ENEMY_COUNT).toBeGreaterThan(90);
    expect(RECIPES.length).toBeGreaterThan(200);
    expect(CHARACTERS.length).toBe(8);
    expect(DIMENSION_DEFS.length).toBe(8);
  });
});

describe('blocks', () => {
  it('drops reference real items', () => {
    for (const b of BLOCK_DEFS) {
      if (b.drops === null || b.drops === undefined) continue;
      expect(itemExists(b.drops), `block ${b.key} drops ${b.drops}`).toBe(true);
    }
  });
  it('self-drop blocks have matching items', () => {
    for (const b of BLOCK_DEFS) {
      if (b.key === 'air' || b.noItem || b.drops !== undefined) continue;
      expect(itemExists(b.key), `block ${b.key} needs an item`).toBe(true);
    }
  });
  it('crop metadata is consistent', () => {
    for (const b of BLOCK_DEFS) {
      if (!b.crop) continue;
      expect(itemExists(b.crop.yields)).toBe(true);
      expect(itemExists(b.crop.seed)).toBe(true);
    }
  });
});

describe('items', () => {
  it('placeables reference real blocks', () => {
    for (const i of ITEM_DEFS) {
      if (i.block) expect(blockIdOpt(i.block), `item ${i.key} places ${i.block}`).toBeDefined();
    }
  });
  it('summons reference real enemies', () => {
    for (const i of ITEM_DEFS) {
      if (i.summons) expect(enemyExists(i.summons), `${i.key} summons ${i.summons}`).toBe(true);
      if (i.weapon?.minion) expect(enemyExists(i.weapon.minion)).toBe(true);
    }
  });
  it('potion/food statuses exist', () => {
    for (const i of ITEM_DEFS) {
      for (const e of i.potion?.effects ?? []) expect(statusExists(e.key), `${i.key}: ${e.key}`).toBe(true);
      for (const b of i.food?.buffs ?? []) expect(statusExists(b.key), `${i.key}: ${b.key}`).toBe(true);
    }
  });
});

describe('recipes', () => {
  it('all inputs and outputs exist', () => {
    for (const r of RECIPES) {
      expect(itemExists(r.out), `recipe out ${r.out}`).toBe(true);
      for (const [k] of r.ins) expect(itemExists(k), `recipe ${r.out} needs ${k}`).toBe(true);
    }
  });
  it('no recipe consumes its own output as sole input', () => {
    for (const r of RECIPES) {
      if (r.ins.length === 1 && r.ins[0][0] === r.out) {
        expect(r.count).toBeGreaterThan(r.ins[0][1]);
      }
    }
  });
});

describe('enemies', () => {
  it('drops and statuses are real', () => {
    for (const e of ENEMY_DEFS) {
      for (const d of e.drops) expect(itemExists(d.item), `${e.key} drops ${d.item}`).toBe(true);
      if (e.inflicts) expect(statusExists(e.inflicts.key)).toBe(true);
      if (e.projectile?.status) expect(statusExists(e.projectile.status.key)).toBe(true);
    }
  });
  it('spawn biomes exist', () => {
    const biomes = new Set(BIOME_DEFS.map((b) => b.key));
    for (const e of ENEMY_DEFS) {
      for (const b of e.spawn?.biomes ?? []) expect(biomes.has(b), `${e.key} biome ${b}`).toBe(true);
    }
  });
});

describe('characters, npcs, quests, dimensions', () => {
  it('character start items exist', () => {
    for (const c of CHARACTERS) for (const [k] of c.startItems) expect(itemExists(k), `${c.key}: ${k}`).toBe(true);
  });
  it('npc shops and quests are real', () => {
    for (const n of NPC_DEFS) {
      for (const [k] of n.shop ?? []) expect(itemExists(k), `${n.key} sells ${k}`).toBe(true);
      for (const q of n.quests ?? []) expect(() => questByKey(q)).not.toThrow();
    }
  });
  it('quest rewards/targets are real', () => {
    for (const q of QUEST_DEFS) {
      for (const [k] of q.rewards) expect(itemExists(k), `${q.key} rewards ${k}`).toBe(true);
      if (q.kind === 'gather' && !q.target.startsWith('#')) expect(itemExists(q.target)).toBe(true);
      if (q.kind === 'kill') expect(enemyExists(q.target)).toBe(true);
      if (q.kind === 'craft') expect(itemExists(q.target)).toBe(true);
      if (q.next) expect(() => questByKey(q.next!)).not.toThrow();
    }
  });
  it('dimensions reference real biomes/blocks/bosses', () => {
    for (const d of DIMENSION_DEFS) {
      for (const b of d.biomes) expect(() => biomeByKey(b)).not.toThrow();
      expect(blockIdOpt(d.stone), `${d.key} stone`).toBeDefined();
      expect(blockIdOpt(d.exclusiveOre)).toBeDefined();
      if (d.frameBlock) expect(blockIdOpt(d.frameBlock)).toBeDefined();
      if (d.bossKey) expect(enemyExists(d.bossKey)).toBe(true);
    }
    for (const b of BIOME_DEFS) {
      expect(blockIdOpt(b.topsoil), `biome ${b.key} topsoil`).toBeDefined();
      expect(blockIdOpt(b.subsoil)).toBeDefined();
    }
  });
});
