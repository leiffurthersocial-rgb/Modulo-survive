/** Main menu, character selection and world management screens. */

import { useEffect, useRef, useState } from 'react';
import { CHARACTERS } from '../../data/characters';
import { humanoidStrip } from '../../render/sprites';
import { listWorlds, deleteWorld, type WorldSummary } from '../../save/saves';
import { loadGame, startNewGame } from '../session';
import { setUI, useUI } from '../store';
import { audio } from '../../audio/engine';

export function MainMenu(): JSX.Element {
  return (
    <div className="screen">
      <div className="title">
        MODULO
        <small>S U R V I V E</small>
      </div>
      <div className="subtitle">an infinite lattice of eight worlds — v0.1.0</div>
      <div className="menu-buttons">
        <button className="primary" onClick={() => { audio.unlock(); setUI({ screen: 'charSelect' }); }}>
          New Expedition
        </button>
        <button onClick={() => { audio.unlock(); setUI({ screen: 'worldSelect' }); }}>Continue</button>
        <button onClick={() => setUI({ screen: 'playing', panel: 'settings' })} disabled>
          {/* settings live in-game; disabled at menu to avoid an empty renderer */}
          Settings (in-game)
        </button>
      </div>
      <div className="subtitle">WASD move · Space jump · E inventory · M map · mouse to mine & fight</div>
    </div>
  );
}

function CharPortrait({ charKey }: { charKey: string }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const def = CHARACTERS.find((c) => c.key === charKey)!;
    const strip = humanoidStrip(`char:${def.key}`, def.appearance);
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, 16, 26);
    ctx.drawImage(strip.canvas, 0, 0, strip.fw, strip.fh, 0, 0, 16, 26);
  }, [charKey]);
  return <canvas ref={ref} width={16} height={26} />;
}

export function CharacterSelect(): JSX.Element {
  const ui = useUI();
  return (
    <div className="screen">
      <h2 style={{ color: 'var(--accent)', letterSpacing: 4 }}>CHOOSE YOUR SURVIVOR</h2>
      <div className="char-grid">
        {CHARACTERS.map((c) => (
          <div
            key={c.key}
            className={`char-card ${ui.selectedCharacter === c.key ? 'selected' : ''}`}
            onClick={() => setUI({ selectedCharacter: c.key })}
          >
            <CharPortrait charKey={c.key} />
            <h3>{c.name}</h3>
            <div className="trait">{c.traitName}</div>
            <div className="desc">{c.traitDesc}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setUI({ screen: 'menu' })}>Back</button>
        <button className="primary" onClick={() => setUI({ screen: 'newWorld' })}>
          Continue
        </button>
      </div>
    </div>
  );
}

export function NewWorld({ parent }: { parent: HTMLElement }): JSX.Element {
  const ui = useUI();
  const [name, setName] = useState('The Keystone');
  const [seed, setSeed] = useState('');
  const character = CHARACTERS.find((c) => c.key === ui.selectedCharacter)!;
  return (
    <div className="screen">
      <h2 style={{ color: 'var(--accent)', letterSpacing: 4 }}>NEW WORLD</h2>
      <div className="form-row">
        <label>World name</label>
        <input type="text" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-row">
        <label>Seed</label>
        <input type="text" value={seed} placeholder="leave empty for random" maxLength={64} onChange={(e) => setSeed(e.target.value)} />
      </div>
      <div className="subtitle">
        Surviving as <b style={{ color: 'var(--accent)' }}>{character.name}</b> the {character.traitName}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setUI({ screen: 'charSelect' })}>Back</button>
        <button className="primary" onClick={() => void startNewGame(parent, name, seed, ui.selectedCharacter)}>
          Enter the Lattice
        </button>
      </div>
    </div>
  );
}

export function WorldSelect({ parent }: { parent: HTMLElement }): JSX.Element {
  const [worlds, setWorlds] = useState<WorldSummary[] | null>(null);
  useEffect(() => {
    void listWorlds().then(setWorlds);
  }, []);
  return (
    <div className="screen">
      <h2 style={{ color: 'var(--accent)', letterSpacing: 4 }}>CONTINUE</h2>
      <div className="world-list">
        {worlds === null && <div className="subtitle">Reading the archive…</div>}
        {worlds?.length === 0 && <div className="subtitle">No worlds yet. Start a new expedition.</div>}
        {worlds?.map((w) => (
          <div key={w.id} className="world-row">
            <div>
              <div>{w.name}</div>
              <div className="meta">
                day {w.day} · {w.characterKey} · seed “{w.seedText}”
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="primary" onClick={() => void loadGame(parent, w.id, w.name)}>
                Play
              </button>
              <button
                className="danger"
                onClick={() => {
                  void deleteWorld(w.id).then(() => listWorlds().then(setWorlds));
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => setUI({ screen: 'menu' })}>Back</button>
    </div>
  );
}
