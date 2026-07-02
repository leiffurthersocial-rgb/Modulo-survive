/** Pooled particle system + weather overlays (rain/snow/ash/sandstorm/fog). */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { TILE } from '../data/constants';
import { css } from './textures';

interface Particle {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  gravity: number;
  active: boolean;
}

let dotTex: Texture | null = null;
function dotTexture(): Texture {
  if (!dotTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 4, 4);
    dotTex = Texture.from(c);
    dotTex.source.scaleMode = 'nearest';
  }
  return dotTex;
}

export class ParticleSystem {
  readonly container = new Container();
  private pool: Particle[] = [];
  enabled = true;

  spawn(key: string, x: number, y: number, count: number, color = 0xffffff, rand: () => number = Math.random): void {
    if (!this.enabled) return;
    for (let i = 0; i < count; i++) {
      const p = this.obtain();
      p.x = x * TILE;
      p.y = y * TILE;
      p.active = true;
      p.sprite.visible = true;
      p.sprite.tint = color;
      p.sprite.alpha = 1;
      p.sprite.scale.set(0.6 + rand() * 0.7);
      switch (key) {
        case 'break':
        case 'mine':
          p.vx = (rand() - 0.5) * 90;
          p.vy = -rand() * 80 - 20;
          p.gravity = 300;
          p.maxLife = 0.5 + rand() * 0.3;
          break;
        case 'impact':
          p.vx = (rand() - 0.5) * 140;
          p.vy = (rand() - 0.5) * 140;
          p.gravity = 100;
          p.maxLife = 0.25 + rand() * 0.2;
          break;
        case 'explosion':
          p.vx = (rand() - 0.5) * 260;
          p.vy = (rand() - 0.5) * 260;
          p.gravity = 60;
          p.maxLife = 0.5 + rand() * 0.4;
          p.sprite.scale.set(1 + rand());
          break;
        case 'death':
          p.vx = (rand() - 0.5) * 120;
          p.vy = -rand() * 120;
          p.gravity = 240;
          p.maxLife = 0.6 + rand() * 0.4;
          break;
        case 'teleport':
        case 'portal':
          p.vx = (rand() - 0.5) * 50;
          p.vy = -rand() * 60 - 10;
          p.gravity = -40;
          p.maxLife = 0.7 + rand() * 0.5;
          break;
        case 'dust':
          p.vx = (rand() - 0.5) * 40;
          p.vy = -rand() * 25;
          p.gravity = 30;
          p.maxLife = 0.8 + rand() * 0.6;
          p.sprite.alpha = 0.6;
          break;
        case 'lightning':
          // A vertical flash column.
          p.vx = 0;
          p.vy = 0;
          p.gravity = 0;
          p.maxLife = 0.2;
          p.sprite.tint = 0xffffff;
          p.sprite.scale.set(3, 40);
          break;
        default:
          p.vx = (rand() - 0.5) * 60;
          p.vy = -rand() * 60;
          p.gravity = 120;
          p.maxLife = 0.5;
      }
      p.life = p.maxLife;
    }
  }

  private obtain(): Particle {
    for (const p of this.pool) if (!p.active) return p;
    const sprite = new Sprite(dotTexture());
    sprite.anchor.set(0.5);
    this.container.addChild(sprite);
    const p: Particle = { sprite, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, gravity: 0, active: false };
    this.pool.push(p);
    return p;
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.sprite.position.set(p.x, p.y);
      p.sprite.alpha = Math.min(1, (p.life / p.maxLife) * 1.6);
    }
  }
}

// ---------------------------------------------------------------------------
// Weather overlay (screen space)
// ---------------------------------------------------------------------------

interface Drop {
  sprite: Sprite;
  vx: number;
  vy: number;
}

export class WeatherView {
  readonly container = new Container();
  private drops: Drop[] = [];
  private fog: Graphics;
  private flash: Graphics;
  private mode = 'clear';
  private w = 800;
  private h = 600;
  flashT = 0;

  constructor() {
    this.fog = new Graphics();
    this.flash = new Graphics();
    this.container.addChild(this.fog, this.flash);
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.redrawOverlays();
  }

  private redrawOverlays(): void {
    this.fog.clear();
    this.fog.rect(0, 0, this.w, this.h).fill({ color: 0xb8c4cc, alpha: 1 });
    this.flash.clear();
    this.flash.rect(0, 0, this.w, this.h).fill({ color: 0xffffff, alpha: 1 });
  }

  setMode(mode: string): void {
    if (mode === this.mode) return;
    this.mode = mode;
    // Rebuild drop pool for the new precipitation type.
    for (const d of this.drops) d.sprite.destroy();
    this.drops = [];
    const count = mode === 'storm' ? 160 : mode === 'rain' ? 110 : mode === 'snow' ? 90 : mode === 'ashfall' ? 70 : mode === 'sandstorm' ? 140 : 0;
    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(dotTexture());
      sprite.anchor.set(0.5);
      switch (mode) {
        case 'rain':
        case 'storm':
          sprite.tint = 0x9fd4e8;
          sprite.scale.set(0.4, 2.4);
          sprite.alpha = 0.55;
          break;
        case 'snow':
          sprite.tint = 0xffffff;
          sprite.scale.set(0.6);
          sprite.alpha = 0.8;
          break;
        case 'ashfall':
          sprite.tint = 0x8a8f98;
          sprite.scale.set(0.5);
          sprite.alpha = 0.7;
          break;
        case 'sandstorm':
          sprite.tint = 0xd9c27e;
          sprite.scale.set(1.4, 0.4);
          sprite.alpha = 0.5;
          break;
      }
      sprite.position.set(Math.random() * this.w, Math.random() * this.h);
      const d: Drop = {
        sprite,
        vx: mode === 'sandstorm' ? -300 - Math.random() * 200 : mode === 'snow' ? -12 : -40,
        vy: mode === 'rain' || mode === 'storm' ? 420 + Math.random() * 160 : mode === 'snow' ? 40 + Math.random() * 30 : mode === 'ashfall' ? 26 + Math.random() * 20 : 20,
      };
      this.container.addChildAt(sprite, 0);
      this.drops.push(d);
    }
  }

  update(dt: number, weather: string, dayLight: number): void {
    this.setMode(weather);
    this.fog.alpha = weather === 'fog' ? 0.22 : weather === 'sandstorm' ? 0.15 : 0;
    if (this.flashT > 0) this.flashT -= dt;
    this.flash.alpha = Math.max(0, this.flashT) * 2.5;
    for (const d of this.drops) {
      const s = d.sprite;
      s.x += d.vx * dt + (weather === 'snow' ? Math.sin(s.y * 0.02) * 14 * dt : 0);
      s.y += d.vy * dt;
      if (s.y > this.h + 8) {
        s.y = -8;
        s.x = Math.random() * (this.w + 100);
      }
      if (s.x < -8) s.x = this.w + 6;
      s.alpha = Math.min(0.85, 0.35 + dayLight * 0.5);
    }
  }

  lightningFlash(): void {
    this.flashT = 0.16;
  }
}

/** Aurora band for the Frozen stratum (cheap sine ribbon). */
export function auroraGraphic(w: number): Graphics {
  const g = new Graphics();
  for (let band = 0; band < 3; band++) {
    const points: number[] = [];
    for (let x = 0; x <= w; x += 16) {
      points.push(x, 60 + band * 26 + Math.sin(x * 0.01 + band * 2) * 22);
    }
    g.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]);
    g.stroke({ width: 14 - band * 3, color: band === 0 ? 0x9ff0ff : band === 1 ? 0x8a5fb0 : 0x58b04c, alpha: 0.12 });
  }
  return g;
}

export { css as _css };
