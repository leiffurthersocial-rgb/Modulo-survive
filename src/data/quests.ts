/** Quest definitions: the milestone chain plus NPC-given quests. */

import type { QuestDef } from './types';

const quests: QuestDef[] = [
  // Milestone chain (auto-granted, tutorializes progression)
  { key: 'm_workbench', name: 'First Principles', desc: 'Craft a Workbench from timber.', kind: 'craft', target: 'workbench', count: 1, rewards: [['torch', 10]], next: 'm_house' },
  { key: 'm_house', name: 'Four Walls', desc: 'Place 30 blocks — get a shelter up before dark.', kind: 'gather', target: '#placed', count: 30, rewards: [['woodDoor', 1], ['plank', 20]], next: 'm_forge' },
  { key: 'm_forge', name: 'Heat and Ore', desc: 'Craft a Forge.', kind: 'craft', target: 'forge', count: 1, rewards: [['copperOre', 9]], next: 'm_iron' },
  { key: 'm_iron', name: 'Ironbound', desc: 'Smelt 5 Iron Bars.', kind: 'craft', target: 'ironBar', count: 5, rewards: [['healingDraughtS', 3]], next: 'm_cavern' },
  { key: 'm_cavern', name: 'Into the Cavern', desc: 'Descend below depth 320.', kind: 'reach', target: '#depth', count: 320, rewards: [['lantern', 2], ['rope', 20]], next: 'm_sigil' },
  { key: 'm_sigil', name: 'Resonance', desc: 'Craft the Resonant Sigil at a Resonance Altar.', kind: 'craft', target: 'resonantSigil', count: 1, rewards: [['healingDraughtM', 2]], next: 'm_warden' },
  { key: 'm_warden', name: 'The First Seal', desc: 'Defeat the Warden of the First Modulus.', kind: 'kill', target: 'bossWarden', count: 1, rewards: [['attunementCore', 1], ['coin', 200]], next: 'm_portal' },
  { key: 'm_portal', name: 'A Door Between Worlds', desc: 'Build and ignite an Ancient portal (4×5 frame).', kind: 'flag', target: 'portal.ancient', count: 1, rewards: [['healingDraughtM', 3], ['coin', 150]], next: 'm_void' },
  { key: 'm_void', name: 'The Remainder', desc: 'Defeat the Null Sovereign in the Void.', kind: 'kill', target: 'bossNull', count: 1, rewards: [['coin', 1000]] },

  // NPC quests
  { key: 'ordo_fiber', name: 'Rope Economics', desc: 'Ordo needs 20 Plant Fiber for stock.', giver: 'ordo', kind: 'gather', target: 'plantFiber', count: 20, rewards: [['coin', 60], ['rope', 20]] },
  { key: 'vessa_berries', name: 'Blood Sugar', desc: 'Bring Vessa 10 Berries.', giver: 'vessa', kind: 'gather', target: 'berries', count: 10, rewards: [['regenBrew', 2]] },
  { key: 'vessa_glow', name: 'Light Reading', desc: 'Bring Vessa 5 Glowshrooms from the caves.', giver: 'vessa', kind: 'gather', target: 'glowshroom', count: 5, rewards: [['nightsightBrew', 3]] },
  { key: 'brann_circuit', name: 'Spare Parts', desc: 'Craft 3 Resonant Circuits for Brann.', giver: 'brann', kind: 'craft', target: 'circuit', count: 3, rewards: [['extractor', 1]] },
  { key: 'kael_depth', name: 'The Buried Paragraph', desc: 'Reach depth 400 — Kael wants rubbings from the deep obelisks.', giver: 'kael', kind: 'reach', target: '#depth', count: 400, rewards: [['coin', 120], ['featherBrew', 2]] },
  { key: 'kael_warden', name: 'Thorough, Not Evil', desc: 'Slay 10 Hollow Shamblers before they wander somewhere worse.', giver: 'kael', kind: 'kill', target: 'hollowShambler', count: 10, rewards: [['coin', 100], ['battleBrew', 1]] },
];

const byKey = new Map(quests.map((q) => [q.key, q]));
export const QUEST_DEFS: readonly QuestDef[] = quests;
export function questByKey(key: string): QuestDef {
  const q = byKey.get(key);
  if (!q) throw new Error(`unknown quest: ${key}`);
  return q;
}
