/** Screen router + panel host. The game canvas lives beneath this UI layer. */

import { useEffect, useRef } from 'react';
import { input, type Action } from '../input/input';
import { mountTouchControls } from '../input/touch';
import { CharacterSelect, MainMenu, NewWorld, WorldSelect } from './components/Menus';
import { HUD } from './components/HUD';
import { DialoguePanel, InventoryPanel, MapPanel, PausePanel, QuestPanel, SettingsPanel } from './components/Panels';
import { getUI, setUI, useUI } from './store';
import { currentSession } from './session';

export function App({ canvasParent }: { canvasParent: HTMLElement }): JSX.Element {
  const ui = useUI();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    input.attach(canvasParent);
    input.onUIAction = (action: Action) => {
      const s = getUI();
      if (s.screen !== 'playing') return;
      const toggle = (panel: typeof s.panel) => setUI({ panel: s.panel === panel ? null : panel, chest: null, dialogueNpc: null });
      switch (action) {
        case 'inventory':
          toggle('inventory');
          break;
        case 'map':
          toggle('map');
          break;
        case 'quests':
          toggle('quests');
          break;
        case 'pause':
          if (s.dialogueNpc || s.chest || s.panel) setUI({ panel: null, chest: null, dialogueNpc: null });
          else setUI({ panel: 'pause' });
          break;
      }
    };
    const unmountTouch = mountTouchControls(rootRef.current!);
    return () => {
      unmountTouch();
      input.onUIAction = () => void 0;
    };
  }, [canvasParent]);

  return (
    <div className="ui-root" ref={rootRef}>
      {ui.screen === 'menu' && <MainMenu />}
      {ui.screen === 'charSelect' && <CharacterSelect />}
      {ui.screen === 'newWorld' && <NewWorld parent={canvasParent} />}
      {ui.screen === 'worldSelect' && <WorldSelect parent={canvasParent} />}
      {ui.screen === 'playing' && (
        <>
          <HUD />
          {ui.panel === 'inventory' && <InventoryPanel />}
          {ui.panel === 'map' && <MapPanel />}
          {ui.panel === 'quests' && <QuestPanel />}
          {ui.panel === 'pause' && <PausePanel />}
          {ui.panel === 'settings' && <SettingsPanel />}
          <DialoguePanel />
          {currentSession()?.renderer.settings.showFps && <div className="fps">{ui.fps} fps</div>}
        </>
      )}
      {ui.loading && <div className="loading">{ui.loading}</div>}
    </div>
  );
}
