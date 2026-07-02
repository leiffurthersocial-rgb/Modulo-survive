/** Quest tracking: milestone chain + NPC quests, driven by bus events. */

import { QUEST_DEFS, questByKey } from '../data/quests';
import type { QuestDef } from '../data/types';
import type { PlayerData, Sim } from './sim';

export interface QuestProgress {
  key: string;
  progress: number;
  done: boolean;
  claimed: boolean;
}

export class QuestLog {
  active = new Map<string, QuestProgress>();
  completed = new Set<string>();

  start(key: string): void {
    if (this.active.has(key) || this.completed.has(key)) return;
    this.active.set(key, { key, progress: 0, done: false, claimed: false });
  }

  startMilestones(): void {
    this.start('m_workbench');
  }

  /** NPC quests become available when talking to the giver. */
  offerFrom(npcKey: string): QuestDef[] {
    return QUEST_DEFS.filter(
      (q) => q.giver === npcKey && !this.active.has(q.key) && !this.completed.has(q.key),
    );
  }

  onCraft(sim: Sim, itemKey: string, count: number): void {
    for (const qp of this.active.values()) {
      const q = questByKey(qp.key);
      if (qp.done || q.kind !== 'craft' || q.target !== itemKey) continue;
      qp.progress += count;
      this.checkDone(sim, qp, q);
    }
  }

  onKill(sim: Sim, enemyKey: string): void {
    for (const qp of this.active.values()) {
      const q = questByKey(qp.key);
      if (qp.done || q.kind !== 'kill' || q.target !== enemyKey) continue;
      qp.progress++;
      this.checkDone(sim, qp, q);
    }
  }

  /** Gather quests read live inventory; reach/flag polled per second. */
  poll(sim: Sim): void {
    const pd = sim.player.data as PlayerData;
    for (const qp of this.active.values()) {
      const q = questByKey(qp.key);
      if (qp.done) continue;
      if (q.kind === 'gather') {
        qp.progress = q.target === '#placed' ? pd.placedCount : pd.inventory.count(q.target);
        this.checkDone(sim, qp, q);
      } else if (q.kind === 'reach') {
        if (q.target === '#depth' && sim.player.y >= q.count) {
          qp.progress = q.count;
          this.checkDone(sim, qp, q);
        }
      } else if (q.kind === 'flag') {
        if (sim.flags.has(q.target)) {
          qp.progress = q.count;
          this.checkDone(sim, qp, q);
        }
      }
    }
  }

  private checkDone(sim: Sim, qp: QuestProgress, q: QuestDef): void {
    if (qp.progress >= q.count && !qp.done) {
      qp.done = true;
      sim.bus.emit('questUpdate', { questKey: qp.key, done: true });
      sim.bus.emit('banner', { title: `Quest complete: ${q.name}`, sub: 'Open the quest log to claim rewards', color: 0x58b04c });
      sim.bus.emit('sound', { key: 'quest' });
    }
  }

  claim(sim: Sim, key: string): boolean {
    const qp = this.active.get(key);
    if (!qp || !qp.done || qp.claimed) return false;
    const q = questByKey(key);
    const pd = sim.player.data as PlayerData;
    // Gather quests hand the items over.
    if (q.kind === 'gather' && !q.target.startsWith('#')) {
      if (pd.inventory.count(q.target) < q.count) return false;
      pd.inventory.remove(q.target, q.count);
    }
    for (const [item, n] of q.rewards) {
      if (item === 'coin') pd.coins += n;
      else sim.addItem(item, n);
    }
    qp.claimed = true;
    this.active.delete(key);
    this.completed.add(key);
    if (q.next) this.start(q.next);
    sim.bus.emit('sound', { key: 'reward' });
    return true;
  }

  serialize(): { active: [string, number, boolean][]; completed: string[] } {
    return {
      active: [...this.active.values()].map((q) => [q.key, q.progress, q.done]),
      completed: [...this.completed],
    };
  }

  static deserialize(data: { active: [string, number, boolean][]; completed: string[] } | undefined): QuestLog {
    const log = new QuestLog();
    if (!data) {
      log.startMilestones();
      return log;
    }
    for (const [key, progress, done] of data.active) {
      log.active.set(key, { key, progress, done, claimed: false });
    }
    log.completed = new Set(data.completed);
    return log;
  }
}
