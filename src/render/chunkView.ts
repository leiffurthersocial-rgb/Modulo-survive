/**
 * Per-chunk baked visuals: one 512×512 canvas for walls+tiles+liquid (rebaked
 * only on change) and one 34×34 light canvas drawn ×16 with bilinear
 * filtering and multiply blend — soft shadows for free.
 */

import { Container, Sprite, Texture } from 'pixi.js';
import { CHUNK, TILE } from '../data/constants';
import { block } from '../data/blocks';
import { Chunk } from '../world/chunk';
import type { World } from '../world/world';
import { atlasUV, blockAtlas, css } from './textures';

const SIZE = CHUNK * TILE; // 512

export class ChunkView {
  readonly key: string;
  readonly tileSprite: Sprite;
  readonly lightSprite: Sprite;
  private tileCanvas: HTMLCanvasElement;
  private tileCtx: CanvasRenderingContext2D;
  private tileTexture: Texture;
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
  private lightTexture: Texture;
  private lightData: ImageData;

  constructor(key: string, cx: number, cy: number, tiles: Container, lights: Container) {
    this.key = key;
    this.tileCanvas = document.createElement('canvas');
    this.tileCanvas.width = SIZE;
    this.tileCanvas.height = SIZE;
    this.tileCtx = this.tileCanvas.getContext('2d')!;
    this.tileTexture = Texture.from(this.tileCanvas);
    this.tileTexture.source.scaleMode = 'nearest';
    this.tileSprite = new Sprite(this.tileTexture);
    this.tileSprite.position.set(cx * SIZE, cy * SIZE);
    tiles.addChild(this.tileSprite);

    this.lightCanvas = document.createElement('canvas');
    this.lightCanvas.width = 34;
    this.lightCanvas.height = 34;
    this.lightCtx = this.lightCanvas.getContext('2d')!;
    this.lightData = this.lightCtx.createImageData(34, 34);
    this.lightTexture = Texture.from(this.lightCanvas);
    this.lightSprite = new Sprite(this.lightTexture);
    this.lightSprite.blendMode = 'multiply';
    this.lightSprite.scale.set(TILE);
    this.lightSprite.position.set(cx * SIZE - TILE, cy * SIZE - TILE);
    lights.addChild(this.lightSprite);
  }

  rebakeTiles(world: World, chunk: Chunk): void {
    const ctx = this.tileCtx;
    const atlas = blockAtlas();
    ctx.clearRect(0, 0, SIZE, SIZE);
    for (let ly = 0; ly < CHUNK; ly++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const i = ly * CHUNK + lx;
        const dx = lx * TILE;
        const dy = ly * TILE;
        // Background wall, darkened.
        const wallId = chunk.bg[i];
        if (wallId !== 0) {
          const [ax, ay] = atlasUV(wallId);
          ctx.drawImage(atlas, ax, ay, TILE, TILE, dx, dy, TILE, TILE);
          ctx.fillStyle = 'rgba(8,10,18,0.52)';
          ctx.fillRect(dx, dy, TILE, TILE);
        }
        // Foreground tile.
        const id = chunk.fg[i];
        if (id !== 0) {
          const [ax, ay] = atlasUV(id);
          ctx.drawImage(atlas, ax, ay, TILE, TILE, dx, dy, TILE, TILE);
        }
        // Liquid.
        const amount = chunk.liquid[i];
        if (amount > 0) {
          const type = chunk.liquidType[i];
          const h = (amount / 8) * TILE;
          ctx.fillStyle = type === 2 ? css(0xff6a33, 0.82) : css(0x3a6ea8, 0.6);
          ctx.fillRect(dx, dy + TILE - h, TILE, h);
          if (type === 2) {
            ctx.fillStyle = css(0xffd884, 0.5);
            ctx.fillRect(dx, dy + TILE - h, TILE, 2);
          } else {
            ctx.fillStyle = css(0x9fd4e8, 0.4);
            ctx.fillRect(dx, dy + TILE - h, TILE, 1);
          }
        }
      }
    }
    this.tileTexture.source.update();
    chunk.visualDirty = false;
    void world;
  }

  /** tint = [r,g,b] 0..1 ambient light color for the current sky. */
  rebakeLight(chunk: Chunk, tint: [number, number, number]): void {
    const d = this.lightData.data;
    const src = chunk.light;
    for (let i = 0; i < 34 * 34; i++) {
      const v = Math.max(10, src[i]); // ambient floor so caves stay readable
      const o = i * 4;
      d[o] = Math.min(255, v * tint[0]);
      d[o + 1] = Math.min(255, v * tint[1]);
      d[o + 2] = Math.min(255, v * tint[2]);
      d[o + 3] = 255;
    }
    this.lightCtx.putImageData(this.lightData, 0, 0);
    this.lightTexture.source.update();
  }

  destroy(): void {
    this.tileSprite.destroy();
    this.lightSprite.destroy();
    this.tileTexture.destroy(true);
    this.lightTexture.destroy(true);
  }
}

/** Crack overlay stages for mining feedback (shared canvas). */
let crackTex: Texture[] | null = null;
export function crackTextures(): Texture[] {
  if (crackTex) return crackTex;
  crackTex = [];
  for (let stage = 0; stage < 4; stage++) {
    const c = document.createElement('canvas');
    c.width = TILE;
    c.height = TILE;
    const ctx = c.getContext('2d')!;
    ctx.strokeStyle = 'rgba(10,10,14,0.85)';
    ctx.beginPath();
    ctx.moveTo(8, 8);
    for (let i = 0; i <= stage + 1; i++) {
      const a = (i / (stage + 2)) * Math.PI * 2 + stage;
      ctx.moveTo(8, 8);
      ctx.lineTo(8 + Math.cos(a) * (3 + stage * 1.6), 8 + Math.sin(a) * (3 + stage * 1.6));
    }
    ctx.stroke();
    const t = Texture.from(c);
    t.source.scaleMode = 'nearest';
    crackTex.push(t);
  }
  return crackTex;
}

/** Does a tile in this block def block placement preview? Utility for cursor. */
export function isSolidBlock(id: number): boolean {
  return id !== 0 && block(id).solid;
}
