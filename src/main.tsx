/** Boot: mount the Pixi canvas host + the React UI overlay. */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

const root = document.getElementById('root')!;

// The game canvas host sits beneath the React overlay.
const canvasHost = document.createElement('div');
canvasHost.style.position = 'fixed';
canvasHost.style.inset = '0';
root.appendChild(canvasHost);

const uiHost = document.createElement('div');
root.appendChild(uiHost);

createRoot(uiHost).render(
  <StrictMode>
    <App canvasParent={canvasHost} />
  </StrictMode>,
);
