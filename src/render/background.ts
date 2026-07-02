/**
 * Sky and parallax: gradient sky, sun/moon, star field, drifting clouds and
 * three procedurally silhouetted hill strata per dimension.
 */

import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { DimensionDef } from '../data/types';
import { Noise1D } from '../core/noise';
import { hashString } from '../core/rng';
import { css, mix, rgb, shade } from './textures';
import { lerp } from '../core/math';

export class BackgroundView {
  readonly container = new Container();
  private skyCanvas: HTMLCanvasElement;
  private skyCtx: CanvasRenderingContext2D;
  private skyTexture: Texture;
  private skySprite: Sprite;
  private sun: Sprite;
  private moon: Sprite;
  private stars: TilingSprite;
  private clouds: TilingSprite;
  private hills: TilingSprite[] = [];
  private dimKey = '';
  private lastSkyUpdate = -1;
  private w = 800;
  private h = 600;

  constructor() {
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 1;
    this.skyCanvas.height = 128;
    this.skyCtx = this.skyCanvas.getContext('2d')!;
    this.skyTexture = Texture.from(this.skyCanvas);
    this.skySprite = new Sprite(this.skyTexture);
    this.container.addChild(this.skySprite);

    this.stars = new TilingSprite({ texture: starTexture(), width: 800, height: 600 });
    this.container.addChild(this.stars);

    this.sun = new Sprite(discTexture(0xffe084, 22, true));
    this.sun.anchor.set(0.5);
    this.moon = new Sprite(discTexture(0xd8dce8, 16, false));
    this.moon.anchor.set(0.5);
    this.container.addChild(this.sun, this.moon);

    this.clouds = new TilingSprite({ texture: cloudTexture(), width: 800, height: 200 });
    this.clouds.alpha = 0.7;
    this.container.addChild(this.clouds);
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.skySprite.width = w;
    this.skySprite.height = h;
    this.stars.width = w;
    this.stars.height = h * 0.7;
    this.clouds.width = w;
    for (const hill of this.hills) {
      hill.width = w;
      hill.y = h - hill.texture.height;
    }
  }

  private buildHills(dim: DimensionDef): void {
    for (const hill of this.hills) hill.destroy();
    this.hills = [];
    const base = dim.key === 'overworld' ? 0x4a6f52 : shade(dim.skyBottom, 0.5);
    for (let layer = 0; layer < 3; layer++) {
      const tex = hillTexture(dim.key, layer, mix(base, dim.skyTop, layer * 0.32));
      const hill = new TilingSprite({ texture: tex, width: this.w, height: tex.height });
      hill.y = this.h - tex.height;
      hill.alpha = 0.85 - layer * 0.12;
      this.container.addChild(hill);
      this.hills.push(hill);
    }
    // Clouds sit above hills.
    this.container.removeChild(this.clouds);
    this.container.addChild(this.clouds);
  }

  update(dim: DimensionDef, timeOfDay: number, dayLight: number, camX: number, camY: number, dtReal: number): void {
    if (dim.key !== this.dimKey) {
      this.dimKey = dim.key;
      this.buildHills(dim);
      this.lastSkyUpdate = -1;
    }
    // Sky gradient (recomputed a few times per second).
    const bucket = Math.round(dayLight * 64);
    if (bucket !== this.lastSkyUpdate) {
      this.lastSkyUpdate = bucket;
      const night = 0x0b0e1a;
      const top = mix(night, dim.skyTop, dayLight);
      const bottom = mix(shade(night, 1.6), dim.skyBottom, dayLight);
      const g = this.skyCtx.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, css(top));
      g.addColorStop(1, css(bottom));
      this.skyCtx.fillStyle = g;
      this.skyCtx.fillRect(0, 0, 1, 128);
      this.skyTexture.source.update();
    }

    // Sun/moon arcs (day: 0.2→0.8; night wraps).
    const dayT = (timeOfDay - 0.2) / 0.6;
    const sunA = Math.PI * (1 - dayT);
    this.sun.position.set(this.w / 2 + Math.cos(sunA) * this.w * 0.42, this.h * 0.78 - Math.sin(sunA) * this.h * 0.55);
    this.sun.visible = dayT > -0.05 && dayT < 1.05 && dim.skyLight > 0.5;
    const nightT = timeOfDay > 0.5 ? (timeOfDay - 0.8) / 0.4 : (timeOfDay + 0.2) / 0.4;
    const moonA = Math.PI * (1 - nightT);
    this.moon.position.set(this.w / 2 + Math.cos(moonA) * this.w * 0.42, this.h * 0.78 - Math.sin(moonA) * this.h * 0.55);
    this.moon.visible = nightT > -0.05 && nightT < 1.05;

    this.stars.alpha = Math.max(0, 1 - dayLight * 1.6) * (dim.key === 'void' ? 1 : 0.9);
    this.stars.tilePosition.x = -camX * 0.05;

    this.clouds.tilePosition.x -= dtReal * 6;
    this.clouds.tilePosition.x -= 0; // wind handled by weather tint elsewhere
    this.clouds.alpha = dim.weather.length > 0 ? 0.55 * dayLight + 0.1 : 0.15;
    this.clouds.y = this.h * 0.12 - camY * 0.03;

    for (let i = 0; i < this.hills.length; i++) {
      const hill = this.hills[i];
      const factor = 0.12 + i * 0.1;
      hill.tilePosition.x = -camX * factor;
      hill.y = this.h - hill.texture.height + camY * 0.02 * (3 - i);
      hill.tint = 0xffffff;
      hill.alpha = lerp(0.25, 0.85 - i * 0.12, dayLight);
    }
  }
}

function discTexture(color: number, r: number, glow: boolean): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = r * 2 + 8;
  const ctx = c.getContext('2d')!;
  const cx = r + 4;
  if (glow) {
    const g = ctx.createRadialGradient(cx, cx, r * 0.5, cx, cx, r + 4);
    g.addColorStop(0, css(color, 0.9));
    g.addColorStop(1, css(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  ctx.fillStyle = css(color);
  ctx.beginPath();
  ctx.arc(cx, cx, r, 0, Math.PI * 2);
  ctx.fill();
  if (!glow) {
    // Moon craters.
    ctx.fillStyle = css(shade(color, 0.8));
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cx - r * 0.2, r * 0.22, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.35, cx + r * 0.3, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  return Texture.from(c);
}

function starTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const n = new Noise1D(hashString('stars'));
  for (let i = 0; i < 90; i++) {
    const x = ((n.sample(i * 13.7) + 1) / 2) * 256;
    const y = ((n.sample(i * 7.3 + 500) + 1) / 2) * 256;
    const b = 0.4 + ((n.sample(i * 3.1 + 900) + 1) / 2) * 0.6;
    ctx.fillStyle = css(0xffffff, b);
    ctx.fillRect(Math.floor(x), Math.floor(y), 1, i % 9 === 0 ? 2 : 1);
  }
  return Texture.from(c);
}

function cloudTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const n = new Noise1D(hashString('clouds'));
  for (let i = 0; i < 7; i++) {
    const x = ((n.sample(i * 31.7) + 1) / 2) * 512;
    const y = 20 + ((n.sample(i * 17.9 + 100) + 1) / 2) * 70;
    const w = 40 + ((n.sample(i * 11.3 + 200) + 1) / 2) * 80;
    for (let k = 0; k < 5; k++) {
      const bx = x + (n.sample(i * 7 + k * 13) * w) / 2;
      const r = w * (0.16 + 0.1 * ((n.sample(k * 5 + i) + 1) / 2));
      ctx.fillStyle = css(0xffffff, 0.5);
      ctx.beginPath();
      ctx.arc((bx + 512) % 512, y + (k % 2) * 6, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return Texture.from(c);
}

function hillTexture(dimKey: string, layer: number, color: number): Texture {
  const c = document.createElement('canvas');
  c.width = 512;
  const height = 140 + layer * 60;
  c.height = height;
  const ctx = c.getContext('2d')!;
  const n = new Noise1D(hashString(`hills:${dimKey}:${layer}`));
  ctx.fillStyle = css(color, 1);
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= 512; x += 4) {
    // Periodic sampling so the tile wraps seamlessly.
    const a = (x / 512) * Math.PI * 2;
    const v = n.sample(Math.cos(a) * 2) * 0.5 + n.sample(Math.sin(a) * 2 + 50) * 0.5;
    const y = height - (0.35 + (v + 1) * 0.25) * height * (0.5 + layer * 0.25);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(512, height);
  ctx.fill();
  const [r, g, b] = rgb(shade(color, 0.8));
  ctx.fillStyle = `rgba(${r},${g},${b},0.4)`;
  ctx.fillRect(0, 0, 512, height);
  return Texture.from(c);
}
