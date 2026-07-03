/**
 * Input: keyboard/mouse with rebindable keys, gamepad polling and touch
 * controls, all funneled into the simulation's InputState intents.
 */

import type { InputState } from '../game/sim';
import { audio } from '../audio/engine';

export type Action =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'jump'
  | 'dodge'
  | 'inventory'
  | 'map'
  | 'quests'
  | 'pause';

export type Bindings = Record<Action, string[]>;

export const DEFAULT_BINDINGS: Bindings = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  jump: ['Space'],
  dodge: ['ShiftLeft', 'ShiftRight'],
  inventory: ['KeyE'],
  map: ['KeyM'],
  quests: ['KeyJ'],
  pause: ['Escape'],
};

const BINDINGS_KEY = 'modulo.bindings.v1';

export function loadBindings(): Bindings {
  try {
    const raw = localStorage.getItem(BINDINGS_KEY);
    if (raw) return { ...DEFAULT_BINDINGS, ...JSON.parse(raw) };
  } catch {
    /* corrupted bindings fall back to defaults */
  }
  return { ...DEFAULT_BINDINGS };
}

export function saveBindings(b: Bindings): void {
  localStorage.setItem(BINDINGS_KEY, JSON.stringify(b));
}

export class InputManager {
  bindings = loadBindings();
  private keys = new Set<string>();
  private mouseButtons = 0;
  private mouseX = 0;
  private mouseY = 0;
  private pressed = new Set<string>(); // edge-triggered action names
  private hotbarSelect = -1;
  /** UI callbacks (inventory/map/quests/pause toggles). */
  onUIAction: (action: Action) => void = () => void 0;
  /** True while a UI panel wants to swallow game input. */
  uiCapture = false;
  touch = { active: false, moveX: 0, jump: false, use: false, interact: false, dodge: false, aimAngle: 0, aimActive: false };

  attach(target: HTMLElement): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      audio.unlock();
      this.keys.add(e.code);
      // Hotbar digits.
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5));
        this.hotbarSelect = n === 0 ? 9 : n - 1;
      }
      for (const action of ['jump', 'dodge'] as Action[]) {
        if (this.bindings[action].includes(e.code)) this.pressed.add(action);
      }
      for (const action of ['inventory', 'map', 'quests', 'pause'] as Action[]) {
        if (this.bindings[action].includes(e.code)) this.onUIAction(action);
      }
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseButtons = 0;
    });
    target.addEventListener('pointerdown', (e) => {
      audio.unlock();
      if (this.uiCapture) return;
      this.mouseButtons |= 1 << e.button;
      if (e.button === 0) this.pressed.add('use');
      if (e.button === 2) this.pressed.add('interact');
    });
    window.addEventListener('pointerup', (e) => {
      this.mouseButtons &= ~(1 << e.button);
    });
    window.addEventListener('pointermove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener(
      'wheel',
      (e) => {
        if (this.uiCapture) return;
        const dir = Math.sign(e.deltaY);
        this.wheelDelta += dir;
        e.preventDefault();
      },
      { passive: false },
    );
  }

  private wheelDelta = 0;
  private gamepadPrev = new Set<number>();

  private down(action: Action): boolean {
    return this.bindings[action].some((code) => this.keys.has(code));
  }

  /** Build this frame's InputState. screenToWorld converts the cursor. */
  getState(
    screenToWorld: (sx: number, sy: number) => [number, number],
    playerPos: [number, number],
    currentHotbar: number,
    facing = 1,
  ): InputState {
    // Gamepad.
    let gpMoveX = 0;
    let gpJump = false;
    let gpUse = false;
    let gpAim: [number, number] | null = null;
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const ax = pad.axes[0] ?? 0;
      if (Math.abs(ax) > 0.25) gpMoveX = ax;
      const rx = pad.axes[2] ?? 0;
      const ry = pad.axes[3] ?? 0;
      if (Math.hypot(rx, ry) > 0.35) {
        gpAim = [playerPos[0] + rx * 6, playerPos[1] + ry * 6];
      }
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      gpJump = b(0);
      gpUse = b(2) || b(7);
      // Edge triggers for gamepad buttons.
      const edges: [number, string][] = [[0, 'jump'], [4, 'dodge'], [2, 'use'], [1, 'interact'], [9, 'pauseBtn'], [3, 'inventoryBtn']];
      for (const [i, name] of edges) {
        const idx = i + 100;
        if (b(i) && !this.gamepadPrev.has(idx)) {
          if (name === 'pauseBtn') this.onUIAction('pause');
          else if (name === 'inventoryBtn') this.onUIAction('inventory');
          else this.pressed.add(name);
          this.gamepadPrev.add(idx);
        } else if (!b(i)) {
          this.gamepadPrev.delete(idx);
        }
      }
      // D-pad hotbar.
      if (b(14) && !this.gamepadPrev.has(214)) {
        this.hotbarSelect = (currentHotbar + 9) % 10;
        this.gamepadPrev.add(214);
      } else if (!b(14)) this.gamepadPrev.delete(214);
      if (b(15) && !this.gamepadPrev.has(215)) {
        this.hotbarSelect = (currentHotbar + 1) % 10;
        this.gamepadPrev.add(215);
      } else if (!b(15)) this.gamepadPrev.delete(215);
    }

    // Wheel hotbar.
    let hotbar = this.hotbarSelect;
    if (this.wheelDelta !== 0) {
      hotbar = (((currentHotbar + this.wheelDelta) % 10) + 10) % 10;
      this.wheelDelta = 0;
    }
    this.hotbarSelect = -1;

    // Touch aim: while the stick is pushed, aim in its direction; otherwise
    // default forward-and-slightly-down (a good default for digging/building).
    // Combat aim-assist handles enemies regardless, so this need not be precise.
    let touchAim: [number, number];
    if (this.touch.aimActive) {
      touchAim = [playerPos[0] + Math.cos(this.touch.aimAngle) * 5, playerPos[1] + Math.sin(this.touch.aimAngle) * 5];
    } else {
      touchAim = [playerPos[0] + facing * 3.5, playerPos[1] + 2];
    }
    const [aimX, aimY] = gpAim ?? (this.touch.active ? touchAim : screenToWorld(this.mouseX, this.mouseY));

    const capture = this.uiCapture;
    const state: InputState = {
      left: !capture && (this.down('left') || gpMoveX < -0.25 || this.touch.moveX < -0.25),
      right: !capture && (this.down('right') || gpMoveX > 0.25 || this.touch.moveX > 0.25),
      up: !capture && (this.down('up')),
      down: !capture && (this.down('down')),
      jump: !capture && (this.down('jump') || gpJump || this.touch.jump),
      jumpPressed: !capture && this.pressed.has('jump'),
      dodgePressed: !capture && this.pressed.has('dodge'),
      use: !capture && ((this.mouseButtons & 1) !== 0 || gpUse || this.touch.use),
      usePressed: !capture && this.pressed.has('use'),
      interactPressed: !capture && (this.pressed.has('interact') || this.touch.interact),
      aimX,
      aimY,
      hotbar,
    };
    if (this.touch.dodge) state.dodgePressed = true;
    this.touch.dodge = false;
    this.touch.interact = false;
    this.pressed.clear();
    return state;
  }
}

export const input = new InputManager();
