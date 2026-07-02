/** Mobile touch controls: virtual joystick (left) + action buttons (right). */

import { input } from './input';

export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

/** Mounts DOM touch controls; returns an unmount function. */
export function mountTouchControls(root: HTMLElement): () => void {
  if (!isTouchDevice()) return () => void 0;
  input.touch.active = true;

  const wrap = document.createElement('div');
  wrap.className = 'touch-controls';

  // Joystick.
  const stick = document.createElement('div');
  stick.className = 'touch-stick';
  const nub = document.createElement('div');
  nub.className = 'touch-nub';
  stick.appendChild(nub);
  wrap.appendChild(stick);

  let stickId = -1;
  const stickCenter = () => {
    const r = stick.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2] as const;
  };
  stick.addEventListener('pointerdown', (e) => {
    stickId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return;
    const [cx, cy] = stickCenter();
    const dx = (e.clientX - cx) / 40;
    const dy = (e.clientY - cy) / 40;
    input.touch.moveX = Math.max(-1, Math.min(1, dx));
    input.touch.aimAngle = Math.atan2(dy, dx);
    nub.style.transform = `translate(${Math.max(-36, Math.min(36, dx * 40))}px, ${Math.max(-36, Math.min(36, dy * 40))}px)`;
  });
  const stickEnd = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return;
    stickId = -1;
    input.touch.moveX = 0;
    nub.style.transform = '';
  };
  stick.addEventListener('pointerup', stickEnd);
  stick.addEventListener('pointercancel', stickEnd);

  // Buttons.
  const buttons: [string, string, (down: boolean) => void][] = [
    ['⤒', 'jump', (d) => (input.touch.jump = d)],
    ['⚔', 'use', (d) => (input.touch.use = d)],
    ['✥', 'interact', (d) => d && (input.touch.interact = true)],
    ['➟', 'dodge', (d) => d && (input.touch.dodge = true)],
  ];
  const btnWrap = document.createElement('div');
  btnWrap.className = 'touch-buttons';
  for (const [label, cls, setter] of buttons) {
    const b = document.createElement('div');
    b.className = `touch-btn touch-${cls}`;
    b.textContent = label;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      setter(true);
    });
    b.addEventListener('pointerup', () => setter(false));
    b.addEventListener('pointercancel', () => setter(false));
    btnWrap.appendChild(b);
  }
  wrap.appendChild(btnWrap);
  root.appendChild(wrap);
  return () => {
    input.touch.active = false;
    wrap.remove();
  };
}
