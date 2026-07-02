/** Inventory stacking, transfer and consumption invariants. */

import { describe, expect, it } from 'vitest';
import { Inventory } from '../src/game/inventory';

describe('inventory', () => {
  it('stacks up to maxStack then opens new slots', () => {
    const inv = new Inventory(4);
    expect(inv.add('dirt', 1200)).toBe(0); // 999 + 201
    expect(inv.count('dirt')).toBe(1200);
    expect(inv.get(0)!.count).toBe(999);
    expect(inv.get(1)!.count).toBe(201);
  });
  it('reports overflow when full', () => {
    const inv = new Inventory(1);
    const left = inv.add('dirt', 1500);
    expect(left).toBe(501);
    expect(inv.count('dirt')).toBe(999);
  });
  it('removes across stacks', () => {
    const inv = new Inventory(3);
    inv.add('stone', 1100);
    expect(inv.remove('stone', 1050)).toBe(1050);
    expect(inv.count('stone')).toBe(50);
  });
  it('has() and consume() honor recipes', () => {
    const inv = new Inventory(10);
    inv.add('timber', 10);
    inv.add('coalOre', 2);
    expect(inv.has([['timber', 8], ['coalOre', 2]])).toBe(true);
    expect(inv.consume([['timber', 8], ['coalOre', 2]], 0, () => 0.99)).toBe(true);
    expect(inv.count('timber')).toBe(2);
    expect(inv.count('coalOre')).toBe(0);
    expect(inv.consume([['timber', 8]], 0, () => 0.99)).toBe(false);
  });
  it('refund chance returns some ingredients', () => {
    const inv = new Inventory(10);
    inv.add('circuit', 10);
    // roll always refunds
    inv.consume([['circuit', 10]], 1, () => 0);
    expect(inv.count('circuit')).toBe(10);
  });
  it('transfer merges and swaps', () => {
    const inv = new Inventory(4);
    inv.add('dirt', 10);
    inv.set(2, { key: 'stone', count: 5 });
    inv.transfer(0, 2); // swap
    expect(inv.get(0)!.key).toBe('stone');
    expect(inv.get(2)!.key).toBe('dirt');
    inv.set(1, { key: 'stone', count: 3 });
    inv.transfer(1, 0); // merge
    expect(inv.get(0)!.count).toBe(8);
    expect(inv.get(1)).toBeNull();
  });
  it('serializes and restores', () => {
    const inv = new Inventory(5);
    inv.add('torch', 42);
    inv.add('ironBar', 3);
    const copy = Inventory.deserialize(inv.serialize(), 5);
    expect(copy.count('torch')).toBe(42);
    expect(copy.count('ironBar')).toBe(3);
  });
});
