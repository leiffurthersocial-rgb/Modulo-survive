/**
 * Procedural entity sprites: body-plan painters emit multi-frame strips on
 * canvases. The eight survivors' looks come straight from their appearance
 * data (hair style/color, glasses, goatee, build…).
 */

import type { CharacterAppearance, SpritePlan } from '../data/types';
import { hash01, hashString } from '../core/rng';
import { css, shade } from './textures';

export interface SpriteStrip {
  canvas: HTMLCanvasElement;
  frames: number;
  fw: number;
  fh: number;
}

const stripCache = new Map<string, SpriteStrip>();

function makeStrip(key: string, fw: number, fh: number, frames: number, paint: (ctx: CanvasRenderingContext2D, frame: number) => void): SpriteStrip {
  let strip = stripCache.get(key);
  if (strip) return strip;
  const canvas = document.createElement('canvas');
  canvas.width = fw * frames;
  canvas.height = fh;
  const ctx = canvas.getContext('2d')!;
  for (let f = 0; f < frames; f++) {
    ctx.save();
    ctx.translate(f * fw, 0);
    paint(ctx, f);
    ctx.restore();
  }
  strip = { canvas, frames, fw, fh };
  stripCache.set(key, strip);
  return strip;
}

// ---------------------------------------------------------------------------
// Humanoid (players, NPCs, humanoid enemies)
// ---------------------------------------------------------------------------

export function humanoidStrip(key: string, a: CharacterAppearance): SpriteStrip {
  return makeStrip(`hum:${key}`, 16, 26, 6, (ctx, f) => {
    // Frames: 0 idle · 1-4 walk · 5 jump/air
    const legPhase = f === 0 ? 0 : f === 5 ? 0.5 : Math.sin(((f - 1) / 4) * Math.PI * 2);
    const bw = Math.round(6 * a.build); // body width
    const bx = 8 - bw / 2;
    const topY = Math.round(26 - 22 * a.height); // taller = smaller topY

    // Legs (pants).
    ctx.fillStyle = css(a.pants);
    const legSpread = f === 5 ? 2 : Math.round(legPhase * 2.4);
    ctx.fillRect(8 - 3 + (legSpread > 0 ? legSpread : 0), 19, 2.5, 7);
    ctx.fillRect(8 + 1 + (legSpread < 0 ? legSpread : 0), 19, 2.5, 7);

    // Torso (shirt).
    ctx.fillStyle = css(a.shirt);
    ctx.fillRect(bx, topY + 9, bw, 10.5);
    ctx.fillStyle = css(shade(a.shirt, 0.8));
    ctx.fillRect(bx, topY + 16, bw, 2);

    // Arms (skin or shirt sleeve).
    ctx.fillStyle = css(shade(a.shirt, 0.9));
    const armSwing = f === 5 ? -2 : Math.round(-legPhase * 2);
    ctx.fillRect(bx - 1.5, topY + 9.5 + armSwing * 0.4, 2, 7);
    ctx.fillRect(bx + bw - 0.5, topY + 9.5 - armSwing * 0.4, 2, 7);
    ctx.fillStyle = css(a.skin);
    ctx.fillRect(bx - 1.5, topY + 15.5 + armSwing * 0.4, 2, 2);
    ctx.fillRect(bx + bw - 0.5, topY + 15.5 - armSwing * 0.4, 2, 2);

    // Head.
    ctx.fillStyle = css(a.skin);
    ctx.fillRect(4.5, topY, 7, 8);
    // Eyes (facing right by default).
    ctx.fillStyle = css(a.eyes);
    ctx.fillRect(9.5, topY + 3, 1.5, 2);
    ctx.fillStyle = css(0xffffff, 0.55);
    ctx.fillRect(9, topY + 3, 0.8, 2);

    // Hair.
    ctx.fillStyle = css(a.hair);
    switch (a.hairStyle) {
      case 'short':
        ctx.fillRect(4, topY - 1, 8, 3);
        ctx.fillRect(4, topY, 2, 4);
        break;
      case 'medium':
        ctx.fillRect(4, topY - 1, 8.5, 3.5);
        ctx.fillRect(3.5, topY, 2, 6);
        ctx.fillRect(11, topY + 1, 1.5, 4);
        break;
      case 'styled':
        ctx.fillRect(4, topY - 2, 8, 3);
        ctx.fillRect(5, topY - 3, 5, 2);
        ctx.fillRect(4, topY, 1.5, 3);
        break;
      case 'middlePart':
        ctx.fillRect(4, topY - 1, 3.5, 3);
        ctx.fillRect(8.5, topY - 1, 3.5, 3);
        ctx.fillRect(3.5, topY, 1.5, 5);
        ctx.fillRect(11, topY, 1.5, 5);
        break;
    }

    // Glasses.
    if (a.glasses) {
      ctx.strokeStyle = css(0x23252b, 0.9);
      ctx.strokeRect(8.5, topY + 2.5, 3, 2.5);
      ctx.beginPath();
      ctx.moveTo(8.5, topY + 3.5);
      ctx.lineTo(5, topY + 3.5);
      ctx.stroke();
    }
    // Goatee.
    if (a.goatee) {
      ctx.fillStyle = css(a.hair);
      ctx.fillRect(8, topY + 6.5, 3, 1.5);
    }
  });
}

/** Enemy/NPC humanoid without character data: derive a look from colors. */
export function genericHumanoid(key: string, color: number, color2: number, scale = 1): SpriteStrip {
  const app: CharacterAppearance = {
    skin: color,
    hair: shade(color, 0.6),
    hairStyle: 'short',
    eyes: color2,
    shirt: shade(color, 0.85),
    pants: shade(color, 0.6),
    height: scale,
    build: scale,
  };
  return humanoidStrip(`gen:${key}`, app);
}

// ---------------------------------------------------------------------------
// Creature plans
// ---------------------------------------------------------------------------

export function creatureStrip(plan: SpritePlan, key: string, color: number, color2: number): SpriteStrip {
  const seed = hashString(`sprite:${key}`);
  const r = (x: number, y: number) => hash01(seed, x, y);
  switch (plan) {
    case 'humanoid':
      return genericHumanoid(key, color, color2);
    case 'blob':
      return makeStrip(`blob:${key}`, 16, 16, 2, (ctx, f) => {
        const squash = f === 1 ? 2 : 0;
        ctx.fillStyle = css(color, 0.85);
        ctx.beginPath();
        ctx.ellipse(8, 10 + squash / 2, 6.5, 5.5 - squash, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(shade(color, 1.35), 0.8);
        ctx.beginPath();
        ctx.ellipse(6, 8 + squash / 2, 2, 1.5, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(color2 ?? 0x23252b, 0.95);
        ctx.fillRect(10, 8 + squash / 2, 1.5, 2);
      });
    case 'flyer':
      return makeStrip(`flyer:${key}`, 18, 14, 2, (ctx, f) => {
        const wing = f === 0 ? -4 : 3;
        ctx.fillStyle = css(shade(color, 0.85));
        ctx.beginPath();
        ctx.moveTo(9, 8);
        ctx.lineTo(2, 8 + wing);
        ctx.lineTo(5, 9);
        ctx.moveTo(9, 8);
        ctx.lineTo(16, 8 + wing);
        ctx.lineTo(13, 9);
        ctx.fill();
        ctx.fillStyle = css(color);
        ctx.beginPath();
        ctx.ellipse(9, 8, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(color2);
        ctx.fillRect(11.5, 7, 1.5, 1.5);
      });
    case 'quad':
      return makeStrip(`quad:${key}`, 20, 14, 2, (ctx, f) => {
        const step = f === 0 ? 0 : 1.5;
        ctx.fillStyle = css(color);
        ctx.beginPath();
        ctx.ellipse(10, 7, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Head.
        ctx.fillRect(14, 2.5, 5, 5);
        // Legs.
        ctx.fillStyle = css(shade(color, 0.7));
        ctx.fillRect(4 + step, 10, 2, 4);
        ctx.fillRect(8 - step, 10, 2, 4);
        ctx.fillRect(12 + step, 10, 2, 4);
        ctx.fillRect(15 - step, 10, 2, 4);
        // Eye / markings.
        ctx.fillStyle = css(color2);
        ctx.fillRect(17, 4, 1.5, 1.5);
        for (let i = 0; i < 3; i++) {
          if (r(i, 9) > 0.4) ctx.fillRect(5 + i * 3, 5 + r(i, 3) * 2, 1.5, 1.5);
        }
      });
    case 'wisp':
      return makeStrip(`wisp:${key}`, 16, 16, 2, (ctx, f) => {
        const pulse = f === 0 ? 0 : 1;
        for (let i = 3; i > 0; i--) {
          ctx.fillStyle = css(color, 0.25 + (3 - i) * 0.25);
          ctx.beginPath();
          ctx.ellipse(8, 7, 2 + i + pulse * 0.5, 2.5 + i + pulse * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // Trailing tail.
        ctx.fillStyle = css(color, 0.5);
        ctx.beginPath();
        ctx.moveTo(6, 10);
        ctx.lineTo(8, 15);
        ctx.lineTo(10, 10);
        ctx.fill();
        ctx.fillStyle = css(color2, 0.95);
        ctx.fillRect(6.5, 6, 1.5, 2);
        ctx.fillRect(9, 6, 1.5, 2);
      });
    case 'turret':
      return makeStrip(`turret:${key}`, 16, 16, 1, (ctx) => {
        ctx.fillStyle = css(shade(color, 0.8));
        ctx.fillRect(3, 11, 10, 4);
        ctx.fillStyle = css(color);
        ctx.beginPath();
        ctx.arc(8, 9, 4.5, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = css(shade(color, 0.65));
        ctx.fillRect(8, 6, 7, 2.5);
        ctx.fillStyle = css(color2);
        ctx.beginPath();
        ctx.arc(7, 8, 1.6, 0, Math.PI * 2);
        ctx.fill();
      });
    case 'orb':
      return makeStrip(`orb:${key}`, 18, 18, 2, (ctx, f) => {
        const spin = f * 0.5;
        ctx.fillStyle = css(color);
        ctx.beginPath();
        ctx.arc(9, 9, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = css(color2, 0.9);
        ctx.beginPath();
        ctx.arc(9, 9, 7.5, spin, spin + Math.PI * 1.2);
        ctx.stroke();
        ctx.fillStyle = css(color2, 0.95);
        ctx.beginPath();
        ctx.arc(9, 9, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(0xffffff, 0.6);
        ctx.fillRect(6, 5, 2, 2);
      });
  }
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------

export function projectileStrip(look: string, color: number): SpriteStrip {
  return makeStrip(`proj:${look}:${color}`, 12, 12, 1, (ctx) => {
    switch (look) {
      case 'arrow':
        ctx.strokeStyle = css(0x8a6238);
        ctx.beginPath();
        ctx.moveTo(1, 6);
        ctx.lineTo(9, 6);
        ctx.stroke();
        ctx.fillStyle = css(color);
        ctx.beginPath();
        ctx.moveTo(9, 4);
        ctx.lineTo(12, 6);
        ctx.lineTo(9, 8);
        ctx.fill();
        break;
      case 'bolt':
        ctx.fillStyle = css(color, 0.9);
        ctx.beginPath();
        ctx.ellipse(6, 6, 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(0xffffff, 0.7);
        ctx.fillRect(7, 5, 3, 2);
        break;
      case 'orb':
        ctx.fillStyle = css(color, 0.4);
        ctx.beginPath();
        ctx.arc(6, 6, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(color);
        ctx.beginPath();
        ctx.arc(6, 6, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'shard':
        ctx.fillStyle = css(color);
        ctx.beginPath();
        ctx.moveTo(1, 8);
        ctx.lineTo(11, 4);
        ctx.lineTo(6, 9);
        ctx.fill();
        break;
      case 'flame':
        ctx.fillStyle = css(color, 0.85);
        ctx.beginPath();
        ctx.moveTo(2, 6);
        ctx.quadraticCurveTo(6, 0, 10, 6);
        ctx.quadraticCurveTo(6, 12, 2, 6);
        ctx.fill();
        ctx.fillStyle = css(0xfff0a0, 0.9);
        ctx.beginPath();
        ctx.arc(7, 6, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'gear':
        ctx.fillStyle = css(color);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.fillRect(5.5 + Math.cos(a) * 4, 5.5 + Math.sin(a) * 4, 2, 2);
        }
        ctx.beginPath();
        ctx.arc(6, 6, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'feather':
        ctx.fillStyle = css(color, 0.9);
        ctx.beginPath();
        ctx.ellipse(6, 6, 5, 2, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = css(shade(color, 0.7));
        ctx.beginPath();
        ctx.moveTo(2, 9);
        ctx.lineTo(10, 3);
        ctx.stroke();
        break;
      default:
        ctx.fillStyle = css(color);
        ctx.beginPath();
        ctx.arc(6, 6, 3, 0, Math.PI * 2);
        ctx.fill();
    }
  });
}
