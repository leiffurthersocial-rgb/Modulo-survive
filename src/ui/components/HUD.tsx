/** In-game HUD: vitals, hotbar, buffs, clock, boss bar, banners, death overlay. */

import { itemByKey } from '../../data/items';
import { statusByKey } from '../../data/status';
import { itemIconURL } from '../../render/textures';
import { currentSession } from '../session';
import { useUI } from '../store';
import type { PlayerData } from '../../game/sim';

function Bar({ cls, value, max, label }: { cls: string; value: number; max: number; label?: string }): JSX.Element {
  return (
    <div className={`bar ${cls}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
      <span>{label ?? `${value} / ${max}`}</span>
    </div>
  );
}

function clockText(t: number): string {
  // 0.25 = 6:00, 0.5 = 12:00 — offset so 0 is midnight.
  const hours = (t * 24 + 0) % 24;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function HUD(): JSX.Element {
  const ui = useUI();
  const hud = ui.hud;
  const session = currentSession();

  const selectHotbar = (i: number) => {
    if (!session) return;
    (session.game.player.data as PlayerData).hotbarIndex = i;
  };

  return (
    <>
      <div className="hud-top-left">
        <Bar cls="hp" value={hud.hp} max={hud.maxHp} />
        <Bar cls="mana" value={hud.mana} max={hud.maxMana} />
        <Bar cls="stamina" value={hud.stamina} max={hud.maxStamina} label=" " />
        <Bar cls="hunger" value={hud.hunger} max={100} label=" " />
        {hud.breath < 100 && <Bar cls="breath" value={hud.breath} max={100} label=" " />}
      </div>

      <div className="hud-top-right">
        <div className="clockrow">
          <span>Day {hud.day + 1}</span>
          <span>{clockText(hud.timeOfDay)}</span>
          <span>{hud.weather !== 'clear' ? hud.weather : ''}</span>
        </div>
        <div>
          {hud.biome} · depth {hud.depth} · {hud.temperature}°
        </div>
        <div className="coins">⛭ {hud.coins}</div>
        {hud.eventName && <div className="event">{hud.eventName}</div>}
      </div>

      <div className="buffs">
        {hud.buffs.map((b) => {
          const def = statusByKey(b.key);
          return (
            <div key={b.key} className={`buff ${def.bad ? 'bad' : ''}`} title={def.name}>
              {def.name} {b.t}s
            </div>
          );
        })}
      </div>

      {ui.bossBar && (
        <div className="bossbar">
          <div className="name">{ui.bossBar.name}</div>
          <Bar cls="" value={ui.bossBar.hp} max={ui.bossBar.maxHp} label=" " />
        </div>
      )}

      <div className="banners">
        {ui.banners.map((b) => (
          <div key={b.id} className="banner" style={b.color ? { borderColor: `#${b.color.toString(16).padStart(6, '0')}` } : undefined}>
            <h4>{b.title}</h4>
            {b.sub && <p>{b.sub}</p>}
          </div>
        ))}
      </div>

      <div className="hotbar">
        {hud.hotbar.map((slot, i) => {
          const rarity = slot ? itemByKey(slot.key).rarity : 0;
          return (
            <div
              key={i}
              className={`slot ${i === hud.hotbarIndex ? 'active' : ''} rarity-${rarity}`}
              onClick={() => selectHotbar(i)}
              title={slot ? itemByKey(slot.key).name : ''}
            >
              <span className="key">{(i + 1) % 10}</span>
              {slot && <img src={itemIconURL(slot.key)} alt="" draggable={false} />}
              {slot && slot.count > 1 && <span className="count">{slot.count}</span>}
            </div>
          );
        })}
      </div>

      {hud.dead && (
        <div className="death-overlay">
          <h1>YOU DIED</h1>
          <div className="subtitle">The lattice reassembles you…</div>
        </div>
      )}
    </>
  );
}
