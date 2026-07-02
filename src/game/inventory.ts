/** Stack-based inventory shared by the player, chests and NPC shops. */

import { itemByKey } from '../data/items';

export interface Slot {
  key: string;
  count: number;
}

export class Inventory {
  slots: (Slot | null)[];

  constructor(size: number) {
    this.slots = new Array(size).fill(null);
  }

  /** Add items; returns the count that did NOT fit. */
  add(key: string, count: number): number {
    const def = itemByKey(key);
    let left = count;
    // Top up existing stacks first.
    for (const s of this.slots) {
      if (left <= 0) break;
      if (s && s.key === key && s.count < def.maxStack) {
        const take = Math.min(def.maxStack - s.count, left);
        s.count += take;
        left -= take;
      }
    }
    // Then open slots.
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(def.maxStack, left);
        this.slots[i] = { key, count: take };
        left -= take;
      }
    }
    return left;
  }

  count(key: string): number {
    let n = 0;
    for (const s of this.slots) if (s && s.key === key) n += s.count;
    return n;
  }

  has(list: readonly (readonly [string, number])[]): boolean {
    return list.every(([k, n]) => this.count(k) >= n);
  }

  /** Remove up to `count`; returns how many were actually removed. */
  remove(key: string, count: number): number {
    let left = count;
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      const s = this.slots[i];
      if (s && s.key === key) {
        const take = Math.min(s.count, left);
        s.count -= take;
        left -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    return count - left;
  }

  /** Consume a recipe's ingredients; `refundChance` may return some inputs. */
  consume(list: readonly (readonly [string, number])[], refundChance = 0, roll: () => number = Math.random): boolean {
    if (!this.has(list)) return false;
    for (const [k, n] of list) {
      let need = n;
      if (refundChance > 0) {
        for (let i = 0; i < n; i++) if (roll() < refundChance) need--;
      }
      this.remove(k, need);
    }
    return true;
  }

  get(i: number): Slot | null {
    return this.slots[i];
  }

  set(i: number, slot: Slot | null): void {
    this.slots[i] = slot;
  }

  /** Move/merge/swap between two slots (drag & drop). */
  transfer(from: number, to: number): void {
    if (from === to) return;
    const a = this.slots[from];
    const b = this.slots[to];
    if (!a) return;
    if (b && b.key === a.key) {
      const max = itemByKey(a.key).maxStack;
      const take = Math.min(max - b.count, a.count);
      b.count += take;
      a.count -= take;
      if (a.count <= 0) this.slots[from] = null;
    } else {
      this.slots[from] = b;
      this.slots[to] = a;
    }
  }

  /** Move a stack between inventories (shift-click). Returns moved count. */
  moveTo(other: Inventory, index: number): number {
    const s = this.slots[index];
    if (!s) return 0;
    const left = other.add(s.key, s.count);
    const moved = s.count - left;
    if (left <= 0) this.slots[index] = null;
    else s.count = left;
    return moved;
  }

  isEmpty(): boolean {
    return this.slots.every((s) => !s);
  }

  serialize(): ([string, number] | null)[] {
    return this.slots.map((s) => (s ? [s.key, s.count] : null));
  }

  static deserialize(data: ([string, number] | null)[], size: number): Inventory {
    const inv = new Inventory(size);
    for (let i = 0; i < Math.min(size, data.length); i++) {
      const d = data[i];
      if (d) inv.slots[i] = { key: d[0], count: d[1] };
    }
    return inv;
  }
}
