/**
 * Procedural pixel-art pipeline: every block tile and item icon is painted at
 * boot into canvases (≈50 ms total). No image assets exist anywhere in the
 * repository — art direction lives in code (ARCHITECTURE.md §6).
 */

import { TILE } from '../data/constants';
import { BLOCK_DEFS } from '../data/blocks';
import { ITEM_DEFS, itemByKey } from '../data/items';
import type { BlockDef, IconSpec } from '../data/types';
import { hash01, hashString } from '../core/rng';

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

export function rgb(c: number): [number, number, number] {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

export function css(c: number, a = 1): string {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${a})`;
}

export function shade(c: number, f: number): number {
  const [r, g, b] = rgb(c);
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (cl(r) << 16) | (cl(g) << 8) | cl(b);
}

export function mix(a: number, b: number, t: number): number {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return (m(ar, br) << 16) | (m(ag, bg) << 8) | m(ab, bb);
}

// ---------------------------------------------------------------------------
// Block atlas
// ---------------------------------------------------------------------------

export const ATLAS_COLS = 16;
let atlasCanvas: HTMLCanvasElement | null = null;

/** Bake (or return) the block atlas; index = block id. */
export function blockAtlas(): HTMLCanvasElement {
  if (atlasCanvas) return atlasCanvas;
  const rows = Math.ceil(BLOCK_DEFS.length / ATLAS_COLS);
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE;
  canvas.height = rows * TILE;
  const ctx = canvas.getContext('2d')!;
  for (let id = 1; id < BLOCK_DEFS.length; id++) {
    const def = BLOCK_DEFS[id];
    const x = (id % ATLAS_COLS) * TILE;
    const y = Math.floor(id / ATLAS_COLS) * TILE;
    ctx.save();
    ctx.translate(x, y);
    paintBlock(ctx, def, id);
    ctx.restore();
  }
  atlasCanvas = canvas;
  return canvas;
}

export function atlasUV(id: number): [number, number] {
  return [(id % ATLAS_COLS) * TILE, Math.floor(id / ATLAS_COLS) * TILE];
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: number, a = 1): void {
  ctx.fillStyle = css(color, a);
  ctx.fillRect(x, y, 1, 1);
}

function paintBlock(ctx: CanvasRenderingContext2D, def: BlockDef, id: number): void {
  const seed = hashString(`tile:${def.key}`);
  const c = def.color;
  const c2 = def.color2 ?? shade(c, 1.35);
  const r = (x: number, y: number, salt = 0) => hash01(seed, x, y, salt);

  const fillNoise = (base: number, variance: number) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const v = 1 - variance / 2 + r(x, y) * variance;
        px(ctx, x, y, shade(base, v));
      }
    }
  };
  const edgeShade = () => {
    ctx.fillStyle = css(shade(c, 1.18), 0.5);
    ctx.fillRect(0, 0, TILE, 1);
    ctx.fillStyle = css(shade(c, 0.6), 0.5);
    ctx.fillRect(0, TILE - 1, TILE, 1);
  };

  switch (def.style) {
    case 'soil':
      fillNoise(c, 0.3);
      for (let i = 0; i < 6; i++) px(ctx, Math.floor(r(i, 0) * 16), Math.floor(r(0, i) * 16), shade(c, 0.65));
      edgeShade();
      break;
    case 'grassTop': {
      fillNoise(c, 0.3);
      for (let x = 0; x < TILE; x++) {
        const depth = 3 + Math.floor(r(x, 99) * 3);
        for (let y = 0; y < depth; y++) px(ctx, x, y, shade(c2, 0.85 + r(x, y, 7) * 0.35));
      }
      break;
    }
    case 'stone':
      fillNoise(c, 0.22);
      for (let i = 0; i < 4; i++) {
        const sx = Math.floor(r(i, 1) * 14);
        const sy = Math.floor(r(1, i) * 14);
        const len = 2 + Math.floor(r(i, 2) * 4);
        for (let k = 0; k < len; k++) px(ctx, Math.min(15, sx + k), Math.min(15, sy + (k % 2)), shade(c, 0.72));
      }
      edgeShade();
      break;
    case 'sand':
      fillNoise(c, 0.16);
      for (let i = 0; i < 14; i++) px(ctx, Math.floor(r(i, 3) * 16), Math.floor(r(3, i) * 16), shade(c, 1.15), 0.7);
      break;
    case 'snow':
      fillNoise(c, 0.08);
      for (let i = 0; i < 6; i++) px(ctx, Math.floor(r(i, 4) * 16), Math.floor(r(4, i) * 16), 0xffffff);
      break;
    case 'ice':
      fillNoise(c, 0.12);
      ctx.strokeStyle = css(0xffffff, 0.35);
      ctx.beginPath();
      ctx.moveTo(2, 14);
      ctx.lineTo(13, 3);
      ctx.moveTo(6, 15);
      ctx.lineTo(15, 6);
      ctx.stroke();
      break;
    case 'brick': {
      fillNoise(c, 0.15);
      ctx.fillStyle = css(shade(c, 0.6));
      for (let y = 0; y < TILE; y += 4) ctx.fillRect(0, y, TILE, 1);
      for (let row = 0; row < 4; row++) {
        const off = (row % 2) * 4;
        for (let x = off; x < TILE; x += 8) ctx.fillRect(x, row * 4, 1, 4);
      }
      break;
    }
    case 'plank': {
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) px(ctx, x, y, shade(c, 0.9 + r(0, y, 9) * 0.25));
      }
      ctx.fillStyle = css(shade(c, 0.65));
      ctx.fillRect(0, 5, TILE, 1);
      ctx.fillRect(0, 11, TILE, 1);
      px(ctx, 3, 2, shade(c, 0.6));
      px(ctx, 12, 8, shade(c, 0.6));
      break;
    }
    case 'plate': {
      fillNoise(c, 0.1);
      ctx.strokeStyle = css(shade(c, 0.65));
      ctx.strokeRect(0.5, 0.5, 15, 15);
      for (const [rx, ry] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(ctx, rx, ry, shade(c, 0.55));
      ctx.fillStyle = css(shade(c, 1.2), 0.4);
      ctx.fillRect(1, 1, TILE - 2, 2);
      break;
    }
    case 'ore': {
      fillNoise(c, 0.22);
      for (let i = 0; i < 5; i++) {
        const ox = 2 + Math.floor(r(i, 5) * 12);
        const oy = 2 + Math.floor(r(5, i) * 12);
        px(ctx, ox, oy, c2);
        px(ctx, ox + 1, oy, shade(c2, 0.8));
        px(ctx, ox, oy + 1, shade(c2, 1.2));
        if (r(i, 6) > 0.5) px(ctx, ox + 1, oy + 1, c2);
      }
      edgeShade();
      break;
    }
    case 'crystal': {
      ctx.clearRect(0, 0, TILE, TILE);
      for (let i = 0; i < 4; i++) {
        const bx = 2 + Math.floor(r(i, 7) * 10);
        const h = 5 + Math.floor(r(7, i) * 8);
        ctx.fillStyle = css(mix(c, c2, r(i, 8)), 0.9);
        ctx.beginPath();
        ctx.moveTo(bx, 15);
        ctx.lineTo(bx + 2, 15 - h);
        ctx.lineTo(bx + 4, 15);
        ctx.fill();
      }
      break;
    }
    case 'glass':
      ctx.clearRect(0, 0, TILE, TILE);
      ctx.fillStyle = css(c, 0.25);
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.strokeStyle = css(shade(c, 1.2), 0.8);
      ctx.strokeRect(0.5, 0.5, 15, 15);
      ctx.strokeStyle = css(0xffffff, 0.5);
      ctx.beginPath();
      ctx.moveTo(3, 12);
      ctx.lineTo(12, 3);
      ctx.stroke();
      break;
    case 'leaf':
      ctx.clearRect(0, 0, TILE, TILE);
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          if (r(x, y, 11) > 0.18) px(ctx, x, y, shade(c, 0.8 + r(x, y, 12) * 0.45));
        }
      }
      break;
    case 'log': {
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) px(ctx, x, y, shade(c, 0.85 + r(x, 0, 13) * 0.3));
      }
      ctx.fillStyle = css(shade(c, 0.6));
      ctx.fillRect(2, 0, 1, TILE);
      ctx.fillRect(13, 0, 1, TILE);
      px(ctx, 7, 5, shade(c, 0.55));
      px(ctx, 8, 5, shade(c, 0.55));
      px(ctx, 7, 6, shade(c, 0.5));
      break;
    }
    case 'plant': {
      ctx.clearRect(0, 0, TILE, TILE);
      const stems = 2 + Math.floor(r(0, 0) * 3);
      for (let i = 0; i < stems; i++) {
        const bx = 3 + Math.floor(r(i, 14) * 10);
        const h = 5 + Math.floor(r(14, i) * 8);
        ctx.strokeStyle = css(shade(0x2f7e3d, 0.9 + r(i, 15) * 0.3));
        ctx.beginPath();
        ctx.moveTo(bx, 16);
        ctx.quadraticCurveTo(bx + (r(i, 16) - 0.5) * 4, 16 - h / 2, bx + (r(i, 17) - 0.5) * 5, 16 - h);
        ctx.stroke();
        // Blossom / cap in the block color.
        px(ctx, bx + Math.floor((r(i, 17) - 0.5) * 5), 15 - h, c);
        px(ctx, bx + Math.floor((r(i, 17) - 0.5) * 5) + 1, 15 - h + 1, shade(c, 1.25));
      }
      break;
    }
    case 'torch':
      ctx.clearRect(0, 0, TILE, TILE);
      ctx.fillStyle = css(0x8a6238);
      ctx.fillRect(7, 6, 2, 9);
      ctx.fillStyle = css(c);
      ctx.fillRect(6, 3, 4, 4);
      ctx.fillStyle = css(0xfff0a0, 0.9);
      ctx.fillRect(7, 4, 2, 2);
      break;
    case 'rope':
      ctx.clearRect(0, 0, TILE, TILE);
      ctx.fillStyle = css(c);
      ctx.fillRect(7, 0, 2, TILE);
      for (let y = 2; y < TILE; y += 4) px(ctx, 6, y, shade(c, 0.75));
      break;
    case 'platform':
      ctx.clearRect(0, 0, TILE, TILE);
      ctx.fillStyle = css(c);
      ctx.fillRect(0, 0, TILE, 5);
      ctx.fillStyle = css(shade(c, 0.65));
      ctx.fillRect(0, 4, TILE, 1);
      px(ctx, 3, 2, shade(c, 0.8));
      px(ctx, 11, 2, shade(c, 0.8));
      break;
    case 'door':
      fillNoise(c, 0.12);
      ctx.strokeStyle = css(shade(c, 0.6));
      ctx.strokeRect(1.5, 0.5, 13, 15);
      ctx.strokeRect(3.5, 2.5, 9, 11);
      px(ctx, 12, 8, 0xe8c84a);
      if (!def.solid) {
        // Open door: mostly clear with a swung panel at the edge.
        ctx.clearRect(0, 0, TILE, TILE);
        ctx.fillStyle = css(c);
        ctx.fillRect(0, 0, 3, TILE);
        px(ctx, 1, 8, 0xe8c84a);
      }
      break;
    case 'chest': {
      ctx.clearRect(0, 0, TILE, TILE);
      ctx.fillStyle = css(c);
      ctx.fillRect(2, 5, 12, 10);
      ctx.fillStyle = css(shade(c, 1.2));
      ctx.fillRect(2, 5, 12, 3);
      ctx.strokeStyle = css(shade(c, 0.55));
      ctx.strokeRect(2.5, 5.5, 11, 9);
      ctx.fillStyle = css(c2);
      ctx.fillRect(7, 8, 2, 3);
      break;
    }
    case 'machine': {
      fillNoise(shade(c, 0.9), 0.12);
      ctx.strokeStyle = css(shade(c, 0.55));
      ctx.strokeRect(1.5, 1.5, 13, 13);
      ctx.fillStyle = css(def.color2 ?? 0x9fe8d0, 0.9);
      ctx.fillRect(4, 4, 3, 3);
      ctx.fillStyle = css(shade(c, 0.7));
      ctx.fillRect(9, 5, 4, 1);
      ctx.fillRect(9, 8, 4, 1);
      ctx.fillRect(4, 11, 8, 2);
      break;
    }
    case 'altar': {
      ctx.clearRect(0, 0, TILE, TILE);
      ctx.fillStyle = css(c);
      ctx.fillRect(3, 10, 10, 5);
      ctx.fillRect(5, 6, 6, 4);
      ctx.fillStyle = css(c2 ?? 0x9a7ae8, 0.95);
      ctx.fillRect(7, 3, 2, 3);
      px(ctx, 6, 2, c2 ?? 0x9a7ae8, 0.6);
      px(ctx, 9, 2, c2 ?? 0x9a7ae8, 0.6);
      break;
    }
    case 'portal': {
      fillNoise(c, 0.15);
      ctx.strokeStyle = css(c2, 0.95);
      ctx.strokeRect(1.5, 1.5, 13, 13);
      ctx.fillStyle = css(c2, 0.65);
      ctx.beginPath();
      ctx.arc(8, 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(0xffffff, 0.6);
      ctx.beginPath();
      ctx.arc(8, 8, 1.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'wallPlain':
      fillNoise(shade(c, 0.95), 0.14);
      break;
    case 'cloud':
      fillNoise(c, 0.06);
      ctx.fillStyle = css(0xffffff, 0.5);
      ctx.fillRect(0, 0, TILE, 3);
      break;
    case 'web':
      ctx.clearRect(0, 0, TILE, TILE);
      ctx.strokeStyle = css(c, 0.75);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(8, 8);
        ctx.lineTo([15, 0, 15, 0][i], [0, 0, 15, 15][i]);
      }
      ctx.arc(8, 8, 4, 0, Math.PI * 2);
      ctx.arc(8, 8, 7, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'furniture': {
      ctx.clearRect(0, 0, TILE, TILE);
      ctx.fillStyle = css(c);
      switch (def.furniture) {
        case 'table':
          ctx.fillRect(1, 6, 14, 2);
          ctx.fillRect(2, 8, 2, 7);
          ctx.fillRect(12, 8, 2, 7);
          break;
        case 'chair':
          ctx.fillRect(4, 3, 2, 12);
          ctx.fillRect(4, 9, 8, 2);
          ctx.fillRect(10, 11, 2, 4);
          break;
        case 'bed':
          ctx.fillRect(1, 9, 14, 4);
          ctx.fillStyle = css(def.color2 ?? 0xd8dce8);
          ctx.fillRect(2, 7, 5, 3);
          ctx.fillStyle = css(shade(c, 0.7));
          ctx.fillRect(1, 13, 2, 2);
          ctx.fillRect(13, 13, 2, 2);
          break;
        case 'station':
          ctx.fillRect(1, 8, 14, 3);
          ctx.fillRect(2, 11, 2, 4);
          ctx.fillRect(12, 11, 2, 4);
          ctx.fillStyle = css(shade(c, 1.3));
          ctx.fillRect(3, 5, 4, 3);
          ctx.fillStyle = css(shade(c, 0.7));
          ctx.fillRect(9, 6, 3, 2);
          break;
        default:
          ctx.fillRect(2, 6, 12, 9);
      }
      break;
    }
    default:
      fillNoise(c, 0.2);
  }

  // Emissive blocks get a soft self-glow dot so they read as lit even unshaded.
  if ((def.light ?? 0) >= 10 && def.style !== 'torch' && def.style !== 'portal') {
    ctx.fillStyle = css(0xffffff, 0.25);
    ctx.fillRect(5, 5, 6, 6);
  }
}

// ---------------------------------------------------------------------------
// Item icons (also exported as data URLs for the React UI)
// ---------------------------------------------------------------------------

const iconCache = new Map<string, HTMLCanvasElement>();
const iconURLCache = new Map<string, string>();

export function itemIconCanvas(itemKey: string): HTMLCanvasElement {
  let c = iconCache.get(itemKey);
  if (!c) {
    c = document.createElement('canvas');
    c.width = TILE;
    c.height = TILE;
    const item = itemByKey(itemKey);
    paintIcon(c.getContext('2d')!, item.icon, itemKey);
    iconCache.set(itemKey, c);
  }
  return c;
}

export function itemIconURL(itemKey: string): string {
  let url = iconURLCache.get(itemKey);
  if (!url) {
    url = itemIconCanvas(itemKey).toDataURL();
    iconURLCache.set(itemKey, url);
  }
  return url;
}

function paintIcon(ctx: CanvasRenderingContext2D, icon: IconSpec, key: string): void {
  const c = icon.color;
  const c2 = icon.color2 ?? shade(c, 1.3);
  const seed = hashString(`icon:${key}`);
  const r = (x: number, y: number) => hash01(seed, x, y);
  const stick = (color = 0x8a6238) => {
    ctx.strokeStyle = css(color);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(4, 12);
    ctx.lineTo(11, 5);
    ctx.stroke();
    ctx.lineWidth = 1;
  };
  switch (icon.shape) {
    case 'block': {
      // Miniature of the block tile.
      const idx = BLOCK_DEFS.findIndex((b) => b.key === key);
      if (idx > 0) {
        const [ax, ay] = atlasUV(idx);
        ctx.drawImage(blockAtlas(), ax, ay, TILE, TILE, 1, 1, 14, 14);
        ctx.strokeStyle = css(0x000000, 0.25);
        ctx.strokeRect(0.5, 0.5, 15, 15);
      } else {
        ctx.fillStyle = css(c);
        ctx.fillRect(2, 2, 12, 12);
      }
      break;
    }
    case 'bar':
      ctx.fillStyle = css(shade(c, 0.8));
      ctx.beginPath();
      ctx.moveTo(2, 11);
      ctx.lineTo(5, 6);
      ctx.lineTo(14, 6);
      ctx.lineTo(11, 11);
      ctx.fill();
      ctx.fillStyle = css(c);
      ctx.fillRect(2, 11, 9, 3);
      ctx.fillStyle = css(shade(c, 1.3), 0.8);
      ctx.fillRect(5, 7, 7, 1);
      break;
    case 'ore':
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = css(shade(c, 0.8 + r(i, 0) * 0.5));
        const ox = 2 + Math.floor(r(i, 1) * 9);
        const oy = 6 + Math.floor(r(1, i) * 6);
        ctx.fillRect(ox, oy, 3, 3);
      }
      break;
    case 'gem':
      ctx.fillStyle = css(c);
      ctx.beginPath();
      ctx.moveTo(8, 2);
      ctx.lineTo(13, 7);
      ctx.lineTo(8, 14);
      ctx.lineTo(3, 7);
      ctx.fill();
      ctx.fillStyle = css(0xffffff, 0.5);
      ctx.fillRect(7, 4, 2, 2);
      break;
    case 'pick':
      stick();
      ctx.strokeStyle = css(c);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(6, 2);
      ctx.quadraticCurveTo(12, 2, 14, 8);
      ctx.stroke();
      ctx.lineWidth = 1;
      break;
    case 'axe':
      stick();
      ctx.fillStyle = css(c);
      ctx.beginPath();
      ctx.moveTo(9, 2);
      ctx.lineTo(15, 4);
      ctx.lineTo(13, 9);
      ctx.lineTo(9, 7);
      ctx.fill();
      break;
    case 'hoe':
      stick();
      ctx.fillStyle = css(c);
      ctx.fillRect(9, 2, 6, 2);
      ctx.fillRect(13, 2, 2, 5);
      break;
    case 'hammer':
      stick();
      ctx.fillStyle = css(c);
      ctx.fillRect(8, 2, 7, 5);
      break;
    case 'sword':
      ctx.strokeStyle = css(c);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, 12);
      ctx.lineTo(13, 3);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = css(0x8a6238);
      ctx.beginPath();
      ctx.moveTo(3, 10);
      ctx.lineTo(6, 13);
      ctx.stroke();
      px(ctx, 3, 13, 0x8a6238);
      break;
    case 'spear':
      ctx.strokeStyle = css(0x8a6238);
      ctx.beginPath();
      ctx.moveTo(2, 14);
      ctx.lineTo(11, 5);
      ctx.stroke();
      ctx.fillStyle = css(c);
      ctx.beginPath();
      ctx.moveTo(10, 6);
      ctx.lineTo(14, 2);
      ctx.lineTo(12, 8);
      ctx.fill();
      break;
    case 'bow':
      ctx.strokeStyle = css(c);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(5, 8, 6, -Math.PI / 2.6, Math.PI / 2.6);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = css(0xd8d8e0, 0.9);
      ctx.beginPath();
      ctx.moveTo(6, 2.5);
      ctx.lineTo(6, 13.5);
      ctx.stroke();
      break;
    case 'wand':
      stick(0x4a3a52);
      ctx.fillStyle = css(c);
      ctx.beginPath();
      ctx.arc(11.5, 4.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      px(ctx, 11, 4, 0xffffff, 0.8);
      break;
    case 'staff':
      ctx.strokeStyle = css(0x4a3a52);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(3, 14);
      ctx.lineTo(11, 4);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = css(c);
      ctx.beginPath();
      ctx.arc(11.5, 3.5, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(c2, 0.8);
      ctx.beginPath();
      ctx.arc(11.5, 3.5, 1.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'helmet':
      ctx.fillStyle = css(c);
      ctx.beginPath();
      ctx.arc(8, 9, 5.5, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(2.5, 9, 11, 3);
      ctx.fillStyle = css(shade(c, 0.6));
      ctx.fillRect(5, 9, 6, 2);
      break;
    case 'chestplate':
      ctx.fillStyle = css(c);
      ctx.fillRect(4, 3, 8, 9);
      ctx.fillRect(2, 3, 2, 5);
      ctx.fillRect(12, 3, 2, 5);
      ctx.fillStyle = css(shade(c, 1.25));
      ctx.fillRect(6, 4, 4, 2);
      ctx.fillStyle = css(shade(c, 0.7));
      ctx.fillRect(7, 8, 2, 4);
      break;
    case 'legs':
      ctx.fillStyle = css(c);
      ctx.fillRect(4, 3, 8, 4);
      ctx.fillRect(4, 7, 3, 7);
      ctx.fillRect(9, 7, 3, 7);
      break;
    case 'ring':
      ctx.strokeStyle = css(c);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(8, 9, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = css(c2);
      ctx.fillRect(7, 3, 3, 3);
      break;
    case 'potion':
      ctx.fillStyle = css(0xbfe0ea, 0.6);
      ctx.fillRect(6, 2, 4, 3);
      ctx.beginPath();
      ctx.moveTo(6, 5);
      ctx.lineTo(4, 13);
      ctx.lineTo(12, 13);
      ctx.lineTo(10, 5);
      ctx.fill();
      ctx.fillStyle = css(c, 0.9);
      ctx.beginPath();
      ctx.moveTo(5.2, 9);
      ctx.lineTo(4.4, 12.5);
      ctx.lineTo(11.6, 12.5);
      ctx.lineTo(10.8, 9);
      ctx.fill();
      ctx.fillStyle = css(0x8a6238);
      ctx.fillRect(6, 1, 4, 2);
      break;
    case 'food':
      ctx.fillStyle = css(c);
      ctx.beginPath();
      ctx.arc(8, 8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(shade(c, 1.3), 0.7);
      ctx.beginPath();
      ctx.arc(6.5, 6.5, 2, 0, Math.PI * 2);
      ctx.fill();
      // bite
      ctx.clearRect(11, 3, 4, 4);
      break;
    case 'seed':
      ctx.fillStyle = css(0xc2a25c);
      ctx.beginPath();
      ctx.moveTo(4, 4);
      ctx.lineTo(12, 4);
      ctx.lineTo(13, 13);
      ctx.lineTo(3, 13);
      ctx.fill();
      ctx.strokeStyle = css(0x8a6238);
      ctx.beginPath();
      ctx.moveTo(4, 4);
      ctx.quadraticCurveTo(8, 1, 12, 4);
      ctx.stroke();
      for (let i = 0; i < 3; i++) px(ctx, 6 + i * 2, 8 + (i % 2) * 2, c);
      break;
    case 'coin':
      ctx.fillStyle = css(c);
      ctx.beginPath();
      ctx.arc(8, 8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = css(shade(c, 0.65));
      ctx.beginPath();
      ctx.arc(8, 8, 3.4, 0, Math.PI * 2);
      ctx.stroke();
      px(ctx, 6, 5, 0xffffff, 0.8);
      break;
    case 'scroll':
      ctx.fillStyle = css(0xe8dfc8);
      ctx.fillRect(4, 2, 8, 12);
      ctx.fillStyle = css(shade(0xe8dfc8, 0.75));
      ctx.fillRect(4, 2, 8, 2);
      ctx.fillRect(4, 12, 8, 2);
      ctx.fillStyle = css(c);
      ctx.fillRect(6, 6, 4, 1);
      ctx.fillRect(6, 8, 4, 1);
      ctx.fillRect(6, 10, 3, 1);
      break;
    case 'part': {
      // Gear.
      ctx.fillStyle = css(c);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.fillRect(7.5 + Math.cos(a) * 5 - 1, 7.5 + Math.sin(a) * 5 - 1, 2.5, 2.5);
      }
      ctx.beginPath();
      ctx.arc(8, 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(shade(c, 0.55));
      ctx.beginPath();
      ctx.arc(8, 8, 1.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bucket':
      ctx.fillStyle = css(0xb8b2a8);
      ctx.beginPath();
      ctx.moveTo(3, 5);
      ctx.lineTo(13, 5);
      ctx.lineTo(11, 14);
      ctx.lineTo(5, 14);
      ctx.fill();
      if (c !== 0xb8b2a8) {
        ctx.fillStyle = css(c);
        ctx.fillRect(5, 5, 6, 3);
      }
      ctx.strokeStyle = css(shade(0xb8b2a8, 0.7));
      ctx.beginPath();
      ctx.arc(8, 5, 4, Math.PI, 0);
      ctx.stroke();
      break;
    case 'arrow':
      ctx.strokeStyle = css(0x8a6238);
      ctx.beginPath();
      ctx.moveTo(3, 13);
      ctx.lineTo(11, 5);
      ctx.stroke();
      ctx.fillStyle = css(c);
      ctx.beginPath();
      ctx.moveTo(10, 6);
      ctx.lineTo(13, 3);
      ctx.lineTo(11, 7);
      ctx.fill();
      ctx.strokeStyle = css(0xd8d8e0);
      ctx.beginPath();
      ctx.moveTo(3, 13);
      ctx.lineTo(5, 13);
      ctx.moveTo(3, 13);
      ctx.lineTo(3, 11);
      ctx.stroke();
      break;
  }
}

/** Warm-up: bake everything up front (call once at boot, ~50 ms). */
export function bakeAllTextures(): void {
  blockAtlas();
  for (const item of ITEM_DEFS) itemIconCanvas(item.key);
}
