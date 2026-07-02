/** Panels: inventory/crafting/chest, map, quest log, NPC dialogue/shop, settings, pause. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { itemByKey, RARITY_NAMES } from '../../data/items';
import { questByKey } from '../../data/quests';
import { npcByKey } from '../../data/npcs';
import { CHUNK } from '../../data/constants';
import { block } from '../../data/blocks';
import type { Inventory } from '../../game/inventory';
import { chestAt } from '../../game/game';
import { craft, recipeList, stationsNearby } from '../../game/crafting';
import { npcDialogue, shopPrice, type NPCData } from '../../game/npcAI';
import type { PlayerData } from '../../game/sim';
import { itemIconURL } from '../../render/textures';
import { audio } from '../../audio/engine';
import { DEFAULT_BINDINGS, input, saveBindings, type Action } from '../../input/input';
import { currentSession, quitToMenu, saveNow } from '../session';
import { bumpInventory, setUI, useUI } from '../store';

// A single "cursor stack" shared by all grids while dragging items.
let cursorStack: { key: string; count: number } | null = null;

function useForceRender(): () => void {
  const [, set] = useState(0);
  return () => set((n) => n + 1);
}

// ---------------------------------------------------------------------------
// Slot grid
// ---------------------------------------------------------------------------

function SlotGrid({
  inv,
  start = 0,
  end,
  cols = 10,
  accept,
  onShiftClick,
}: {
  inv: Inventory;
  start?: number;
  end?: number;
  cols?: number;
  accept?: (key: string) => boolean;
  onShiftClick?: (index: number) => void;
}): JSX.Element {
  const force = useForceRender();
  const stop = end ?? inv.slots.length;
  const cells = [];
  for (let i = start; i < stop; i++) {
    const slot = inv.get(i);
    const rarity = slot ? itemByKey(slot.key).rarity : 0;
    cells.push(
      <div
        key={i}
        className={`slot rarity-${rarity}`}
        title={slot ? tooltipText(slot.key) : ''}
        onClick={(e) => {
          if (e.shiftKey && onShiftClick) {
            onShiftClick(i);
          } else if (cursorStack) {
            if (accept && !accept(cursorStack.key)) return;
            const held = cursorStack;
            const there = inv.get(i);
            if (there && there.key === held.key) {
              const max = itemByKey(held.key).maxStack;
              const take = Math.min(max - there.count, held.count);
              there.count += take;
              held.count -= take;
              if (held.count <= 0) cursorStack = null;
            } else {
              inv.set(i, { ...held });
              cursorStack = there ? { ...there } : null;
            }
          } else if (slot) {
            cursorStack = { ...slot };
            inv.set(i, null);
          }
          audio.sfx('uiClick');
          bumpInventory();
          force();
        }}
      >
        {slot && <img src={itemIconURL(slot.key)} alt="" draggable={false} />}
        {slot && slot.count > 1 && <span className="count">{slot.count}</span>}
      </div>,
    );
  }
  return <div className={`inv-grid ${cols === 8 ? 'small' : ''}`} style={cols !== 10 && cols !== 8 ? { gridTemplateColumns: `repeat(${cols}, 44px)` } : undefined}>{cells}</div>;
}

function tooltipText(key: string): string {
  const item = itemByKey(key);
  const bits = [item.name, RARITY_NAMES[item.rarity]];
  if (item.tool) bits.push(`${item.tool.type} · power ${item.tool.power} · speed ${item.tool.speed}`);
  if (item.weapon) bits.push(`${item.weapon.type} · ${item.weapon.dmg} dmg`);
  if (item.armor) bits.push(`${item.armor.slot} · ${item.armor.defense} def`);
  if (item.food) bits.push(`+${item.food.hunger} food`);
  if (item.desc) bits.push(item.desc);
  return bits.join('\n');
}

// ---------------------------------------------------------------------------
// Inventory + crafting + chest
// ---------------------------------------------------------------------------

export function InventoryPanel(): JSX.Element | null {
  const ui = useUI();
  const session = currentSession();
  const force = useForceRender();
  if (!session) return null;
  const game = session.game;
  const pd = game.player.data as PlayerData;
  const chest = ui.chest ? chestAt(game, ui.chest.x, ui.chest.y) : null;

  const stations = useMemo(() => stationsNearby(game), [ui.invVersion, game]);
  const recipes = useMemo(() => recipeList(game, stations), [stations, ui.invVersion, game]);

  return (
    <div className="panel-overlay" onClick={() => closePanels()}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <h2>{chest ? 'Chest' : 'Inventory'}</h2>
        <div className="inv-layout">
          <div>
            {chest && (
              <>
                <h3>Chest</h3>
                <SlotGrid inv={chest} cols={8} onShiftClick={(i) => { chest.moveTo(pd.inventory, i); bumpInventory(); force(); }} />
              </>
            )}
            <h3>Backpack</h3>
            <SlotGrid
              inv={pd.inventory}
              onShiftClick={(i) => {
                if (chest) pd.inventory.moveTo(chest, i);
                else quickEquip(pd, i);
                bumpInventory();
                force();
              }}
            />
            <div style={{ display: 'flex', gap: 18 }}>
              <div>
                <h3>Armor</h3>
                <SlotGrid inv={pd.armor} cols={3} accept={(k) => !!itemByKey(k).armor} />
              </div>
              <div>
                <h3>Accessories</h3>
                <SlotGrid inv={pd.accessories} cols={4} accept={(k) => !!itemByKey(k).accessory} />
              </div>
            </div>
            <div className="subtitle" style={{ marginTop: 8 }}>
              shift-click to quick-move / equip · near stations: {[...stations].join(', ') || 'none'}
            </div>
          </div>
          {!chest && (
            <div>
              <h3>Crafting</h3>
              <div className="craft-list">
                {recipes.map((rv, i) => {
                  const out = itemByKey(rv.recipe.out);
                  return (
                    <div
                      key={`${rv.recipe.out}-${i}`}
                      className={`recipe ${rv.canCraft ? '' : 'no'}`}
                      title={tooltipText(rv.recipe.out)}
                      onClick={() => {
                        if (rv.canCraft && craft(game, rv.recipe)) {
                          bumpInventory();
                          force();
                        }
                      }}
                    >
                      <img src={itemIconURL(rv.recipe.out)} alt="" />
                      <div>
                        <div>
                          {out.name} {rv.recipe.count > 1 ? `×${rv.recipe.count}` : ''}
                        </div>
                        <div className="ins">{rv.recipe.ins.map(([k, n]) => `${n} ${itemByKey(k).name}`).join(' · ')}</div>
                      </div>
                      {rv.recipe.station && <span className="station-tag">{rv.recipe.station}</span>}
                    </div>
                  );
                })}
                {recipes.length === 0 && <div className="subtitle">Gather materials to discover recipes.</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function quickEquip(pd: PlayerData, i: number): void {
  const slot = pd.inventory.get(i);
  if (!slot) return;
  const item = itemByKey(slot.key);
  if (item.armor) {
    const idx = item.armor.slot === 'head' ? 0 : item.armor.slot === 'chest' ? 1 : 2;
    const prev = pd.armor.get(idx);
    pd.armor.set(idx, { key: slot.key, count: 1 });
    pd.inventory.set(i, prev ? { ...prev } : null);
    if (slot.count > 1) pd.inventory.add(slot.key, slot.count - 1);
  } else if (item.accessory) {
    for (let a = 0; a < pd.accessories.slots.length; a++) {
      if (!pd.accessories.get(a)) {
        pd.accessories.set(a, { key: slot.key, count: 1 });
        pd.inventory.set(i, slot.count > 1 ? { key: slot.key, count: slot.count - 1 } : null);
        return;
      }
    }
  }
}

function closePanels(): void {
  cursorStack = null;
  setUI({ panel: null, chest: null });
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

export function MapPanel(): JSX.Element | null {
  const ref = useRef<HTMLCanvasElement>(null);
  const session = currentSession();
  useEffect(() => {
    if (!session) return;
    const game = session.game;
    const draw = () => {
      const canvas = ref.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#05070e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const px = game.player.x;
      const py = game.player.y;
      const scale = 2; // pixels per tile
      for (const chunk of game.world.chunks.values()) {
        for (let ly = 0; ly < CHUNK; ly++) {
          for (let lx = 0; lx < CHUNK; lx++) {
            if (!chunk.isExplored(lx, ly)) continue;
            const wx = chunk.cx * CHUNK + lx;
            const wy = chunk.cy * CHUNK + ly;
            const id = chunk.fg[ly * CHUNK + lx];
            const sx = canvas.width / 2 + (wx - px) * scale;
            const sy = canvas.height / 2 + (wy - py) * scale;
            if (sx < 0 || sy < 0 || sx >= canvas.width || sy >= canvas.height) continue;
            const c = id === 0 ? 0x11162a : block(id).color;
            ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`;
            ctx.fillRect(sx, sy, scale, scale);
          }
        }
      }
      // Player marker.
      ctx.fillStyle = '#e8c84a';
      ctx.fillRect(canvas.width / 2 - 2, canvas.height / 2 - 2, 4, 4);
    };
    draw();
    const iv = setInterval(draw, 600);
    return () => clearInterval(iv);
  }, [session]);
  if (!session) return null;
  return (
    <div className="panel-overlay" onClick={() => setUI({ panel: null })}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <h2>Map — {session.worldName}</h2>
        <canvas ref={ref} className="map-canvas" width={560} height={420} />
        <div className="subtitle">Explored terrain around you. Travel to reveal more.</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

export function QuestPanel(): JSX.Element | null {
  const session = currentSession();
  const force = useForceRender();
  useUI();
  if (!session) return null;
  const log = session.game.quests;
  const active = [...log.active.values()];
  return (
    <div className="panel-overlay" onClick={() => setUI({ panel: null })}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <h2>Quest Log</h2>
        {active.length === 0 && <div className="subtitle">Nothing pending. Talk to the survivors.</div>}
        {active.map((qp) => {
          const q = questByKey(qp.key);
          return (
            <div key={qp.key} className="quest">
              <h4>{q.name}</h4>
              <p>{q.desc}</p>
              <div className="progress">
                {Math.min(qp.progress, q.count)} / {q.count}
                {qp.done && (
                  <button
                    style={{ marginLeft: 12, padding: '2px 10px', fontSize: 11 }}
                    className="primary"
                    onClick={() => {
                      log.claim(session.game, qp.key);
                      bumpInventory();
                      force();
                    }}
                  >
                    Claim reward
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <h3>Completed: {log.completed.size}</h3>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NPC dialogue & shop
// ---------------------------------------------------------------------------

export function DialoguePanel(): JSX.Element | null {
  const ui = useUI();
  const session = currentSession();
  const force = useForceRender();
  const [line, setLine] = useState('');
  useEffect(() => {
    if (!session || !ui.dialogueNpc) return;
    if (ui.dialogueNpc === '#tablet') return;
    setLine(npcDialogue(session.game, ui.dialogueNpc));
  }, [ui.dialogueNpc, session]);
  if (!session || !ui.dialogueNpc) return null;
  const game = session.game;
  const pd = game.player.data as PlayerData;

  if (ui.dialogueNpc === '#tablet') {
    return (
      <div className="dialogue" onClick={() => setUI({ dialogueNpc: null })}>
        <div className="npc-name">LORE TABLET</div>
        <div className="line">{line || 'THE LATTICE HELD FOR TEN THOUSAND CYCLES. THEN THE REMAINDER.'}</div>
        <div className="subtitle">click to close</div>
      </div>
    );
  }

  const def = npcByKey(ui.dialogueNpc);
  const npcEnt = game.entities.find((e) => e.kind === 'npc' && e.data.defKey === def.key);
  const happiness = npcEnt ? ((npcEnt.data as NPCData).happiness ?? 1) : 1;
  const offers = game.quests.offerFrom(def.key);

  return (
    <div className="dialogue">
      <div className="npc-name">
        {def.name} {def.title}
      </div>
      <div className="line">“{line}”</div>
      {def.shop && (
        <>
          <h3 style={{ margin: '6px 0', fontSize: 12, color: 'var(--dim)' }}>WARES (you have ⛭ {pd.coins})</h3>
          <div className="shop-grid">
            {def.shop.map(([key, override]) => {
              const item = itemByKey(key);
              const price = shopPrice(game, def.key, item.value, override, happiness);
              return (
                <div
                  key={key}
                  className="shop-item"
                  title={tooltipText(key)}
                  onClick={() => {
                    if (pd.coins >= price) {
                      pd.coins -= price;
                      game.addItem(key, 1);
                      audio.sfx('coin');
                      force();
                    } else {
                      audio.sfx('fizzle');
                    }
                  }}
                >
                  <img src={itemIconURL(key)} alt="" />
                  <div className="price">⛭ {price}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {offers.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {offers.map((q) => (
            <button
              key={q.key}
              style={{ marginRight: 6, fontSize: 12 }}
              onClick={() => {
                game.quests.start(q.key);
                force();
                setUI({ dialogueNpc: null, panel: 'quests' });
              }}
            >
              Quest: {q.name}
            </button>
          ))}
        </div>
      )}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button onClick={() => setLine(npcDialogue(game, def.key))}>Talk</button>
        <button onClick={() => setUI({ dialogueNpc: null })}>Leave</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings & pause
// ---------------------------------------------------------------------------

export function SettingsPanel(): JSX.Element | null {
  const session = currentSession();
  const force = useForceRender();
  const [listening, setListening] = useState<Action | null>(null);

  useEffect(() => {
    if (!listening) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      input.bindings[listening] = [e.code];
      saveBindings(input.bindings);
      setListening(null);
    };
    window.addEventListener('keydown', handler, { once: true });
    return () => window.removeEventListener('keydown', handler);
  }, [listening]);

  const settings = session?.renderer.settings;
  return (
    <div className="panel-overlay" onClick={() => setUI({ panel: session ? 'pause' : null })}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <h3>Audio</h3>
        {(['master', 'music', 'sfx', 'ambient'] as const).map((bus) => (
          <div key={bus} className="settings-row">
            <span>{bus}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              defaultValue={audio.volumes[bus]}
              onChange={(e) => {
                audio.volumes[bus] = Number(e.target.value);
                audio.applyVolumes();
              }}
            />
          </div>
        ))}
        {settings && (
          <>
            <h3>Graphics</h3>
            <div className="settings-row">
              <span>Zoom</span>
              <input type="range" min={1.4} max={4} step={0.2} defaultValue={settings.zoom} onChange={(e) => (settings.zoom = Number(e.target.value))} />
            </div>
            <div className="settings-row">
              <span>Particles</span>
              <input type="checkbox" defaultChecked={settings.particles} onChange={(e) => (settings.particles = e.target.checked)} />
            </div>
            <div className="settings-row">
              <span>Screen shake</span>
              <input type="checkbox" defaultChecked={settings.screenShake} onChange={(e) => (settings.screenShake = e.target.checked)} />
            </div>
            <div className="settings-row">
              <span>Lighting quality</span>
              <select
                defaultValue={settings.lightBudget}
                onChange={(e) => (settings.lightBudget = Number(e.target.value))}
                style={{ background: '#131a30', color: 'var(--text)', border: '1px solid var(--panel-border)', borderRadius: 4, padding: 4 }}
              >
                <option value={2}>Low</option>
                <option value={4}>Medium</option>
                <option value={8}>High</option>
              </select>
            </div>
            <div className="settings-row">
              <span>Show FPS</span>
              <input type="checkbox" defaultChecked={settings.showFps} onChange={(e) => (settings.showFps = e.target.checked)} />
            </div>
          </>
        )}
        <h3>Controls</h3>
        {(Object.keys(DEFAULT_BINDINGS) as Action[]).map((action) => (
          <div key={action} className="settings-row">
            <span>{action}</span>
            <span className="bind">
              <span className={`keycap ${listening === action ? 'listening' : ''}`} onClick={() => setListening(action)}>
                {listening === action ? 'press a key…' : input.bindings[action].join(' / ')}
              </span>
            </span>
          </div>
        ))}
        <div className="settings-row">
          <span />
          <button
            onClick={() => {
              input.bindings = { ...DEFAULT_BINDINGS };
              saveBindings(input.bindings);
              force();
            }}
          >
            Reset bindings
          </button>
        </div>
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setUI({ panel: session ? 'pause' : null })}>Back</button>
        </div>
      </div>
    </div>
  );
}

export function PausePanel(): JSX.Element {
  return (
    <div className="panel-overlay">
      <div className="panel" style={{ minWidth: 300, textAlign: 'center' }}>
        <h2>Paused</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="primary" onClick={() => setUI({ panel: null })}>
            Resume
          </button>
          <button onClick={() => void saveNow()}>Save</button>
          <button onClick={() => setUI({ panel: 'settings' })}>Settings</button>
          <button className="danger" onClick={() => void quitToMenu()}>
            Save & Quit
          </button>
        </div>
      </div>
    </div>
  );
}
