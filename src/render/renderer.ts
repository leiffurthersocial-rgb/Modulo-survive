/**
 * PixiJS renderer: layer tree, camera with trauma shake, chunk view lifecycle,
 * budgeted light rebakes, entity sprites, particles, weather and damage text.
 * Reads the game read-only; all effects arrive via the event bus.
 */

import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { CHUNK, LOAD_RADIUS_X, LOAD_RADIUS_Y, TILE } from '../data/constants';
import { enemyByKey } from '../data/enemies';
import { npcByKey } from '../data/npcs';
import { block, blockIdOpt } from '../data/blocks';
import { lerp, clamp } from '../core/math';
import { computeChunkLight } from '../world/lighting';
import { chunkKey } from '../world/chunk';
import type { Game } from '../game/game';
import type { Entity } from '../game/entities';
import type { InputState, PlayerData } from '../game/sim';
import { dimensionByKey } from '../data/dimensions';
import { BackgroundView } from './background';
import { ChunkView, crackTextures } from './chunkView';
import { ParticleSystem, WeatherView } from './particles';
import { bakeAllTextures, itemIconCanvas } from './textures';
import { creatureStrip, humanoidStrip, projectileStrip, type SpriteStrip } from './sprites';

export interface RenderSettings {
  zoom: number;
  particles: boolean;
  screenShake: boolean;
  /** Light rebakes per frame (2 = low, 4 = medium, 8 = high). */
  lightBudget: number;
  showFps: boolean;
}

interface EntityView {
  sprite: Sprite;
  stripKey: string;
}

const frameTexCache = new Map<string, Texture[]>();

function stripTextures(key: string, strip: SpriteStrip): Texture[] {
  let list = frameTexCache.get(key);
  if (!list) {
    const base = Texture.from(strip.canvas);
    base.source.scaleMode = 'nearest';
    list = [];
    for (let f = 0; f < strip.frames; f++) {
      list.push(new Texture({ source: base.source, frame: new Rectangle(f * strip.fw, 0, strip.fw, strip.fh) }));
    }
    frameTexCache.set(key, list);
  }
  return list;
}

export class Renderer {
  readonly app: Application;
  readonly settings: RenderSettings = { zoom: 2.4, particles: true, screenShake: true, lightBudget: 4, showFps: false };

  private background = new BackgroundView();
  private worldRoot = new Container();
  private tileLayer = new Container();
  private entityLayer = new Container();
  private particleSys = new ParticleSystem();
  private lightLayer = new Container();
  private textLayer = new Container();
  private weather = new WeatherView();

  private chunkViews = new Map<string, ChunkView>();
  private entityViews = new Map<number, EntityView>();
  private playerSprite: Sprite | null = null;
  private heldItem: Sprite | null = null;
  private heldItemKey = '';
  private crack: Sprite;
  private reticle: Graphics;
  private glow: Sprite;
  private damageTexts: { text: Text; vy: number; life: number }[] = [];
  private camX = 0;
  private camY = 0;
  private trauma = 0;
  private lastDayBucket = -1;
  private lastDim = '';
  private offBus: (() => void)[] = [];
  private animT = 0;

  private constructor(app: Application) {
    this.app = app;
    bakeAllTextures();
    app.stage.addChild(this.background.container);
    this.worldRoot.addChild(this.tileLayer, this.entityLayer, this.particleSys.container, this.lightLayer, this.textLayer);
    app.stage.addChild(this.worldRoot);
    app.stage.addChild(this.weather.container);

    this.crack = new Sprite(crackTextures()[0]);
    this.crack.visible = false;
    this.entityLayer.addChild(this.crack);

    this.reticle = new Graphics();
    this.reticle.rect(0.5, 0.5, TILE - 1, TILE - 1).stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
    this.textLayer.addChild(this.reticle);

    this.glow = new Sprite(glowTexture());
    this.glow.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.glow.visible = false;
    this.lightLayer.addChild(this.glow);

    this.background.resize(app.screen.width, app.screen.height);
    this.weather.resize(app.screen.width, app.screen.height);
  }

  static async create(parent: HTMLElement): Promise<Renderer> {
    const app = new Application();
    await app.init({
      background: 0x0b0e1a,
      resizeTo: parent,
      antialias: false,
      roundPixels: true,
      preference: 'webgl',
    });
    parent.appendChild(app.canvas);
    return new Renderer(app);
  }

  attachGame(game: Game): void {
    this.detachGame();
    this.offBus.push(
      game.bus.on('particles', (p) => this.particleSys.spawn(p.key, p.x, p.y, this.settings.particles ? p.count : Math.min(2, p.count), p.color)),
      game.bus.on('screenShake', ({ amount }) => {
        if (this.settings.screenShake) this.trauma = Math.min(1, this.trauma + amount / 10);
      }),
      game.bus.on('damageNumber', (d) => this.pushDamage(d.x, d.y, d.amount, d.crit, d.color)),
      game.bus.on('weatherChanged', () => void 0),
    );
    // Lightning flash hook.
    this.offBus.push(
      game.bus.on('sound', ({ key }) => {
        if (key === 'thunder') this.weather.lightningFlash();
      }),
    );
  }

  detachGame(): void {
    for (const off of this.offBus) off();
    this.offBus = [];
    for (const v of this.chunkViews.values()) v.destroy();
    this.chunkViews.clear();
    for (const v of this.entityViews.values()) v.sprite.destroy();
    this.entityViews.clear();
    this.playerSprite?.destroy();
    this.playerSprite = null;
    this.heldItem?.destroy();
    this.heldItem = null;
    this.heldItemKey = '';
    this.lastDim = '';
  }

  /** Main per-frame hook. `alpha` = interpolation between sim steps. */
  render(game: Game, input: InputState, alpha: number, dtReal: number): void {
    this.animT += dtReal;
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    const pd = game.player.data as PlayerData;

    // --- camera ---
    const px = lerp(game.player.px, game.player.x, alpha);
    const py = lerp(game.player.py, game.player.y, alpha);
    const lookAhead = clamp(game.player.vx * 0.35, -4, 4);
    this.camX = lerp(this.camX, px + lookAhead, Math.min(1, dtReal * 6));
    this.camY = lerp(this.camY, py - 1, Math.min(1, dtReal * 6));
    this.trauma = Math.max(0, this.trauma - dtReal * 1.4);
    const shake = this.trauma * this.trauma * 10;
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;

    const zoom = this.settings.zoom;
    this.worldRoot.scale.set(zoom);
    this.worldRoot.position.set(
      Math.round(screenW / 2 - (this.camX * TILE + sx) * zoom),
      Math.round(screenH / 2 - (this.camY * TILE + sy) * zoom),
    );

    // --- background & weather ---
    const dim = dimensionByKey(game.dimKey);
    const dayLight = game.dayLight();
    this.background.update(dim, game.timeOfDay, dayLight, this.camX * TILE, this.camY * TILE, dtReal);
    this.weather.update(dtReal, game.weather, dayLight);

    // --- chunk views: create/destroy to mirror loaded chunks ---
    if (game.dimKey !== this.lastDim) {
      this.lastDim = game.dimKey;
      for (const v of this.chunkViews.values()) v.destroy();
      this.chunkViews.clear();
    }
    const liveKeys = new Set<string>();
    for (const chunk of game.world.chunks.values()) {
      const key = chunkKey(chunk.cx, chunk.cy);
      liveKeys.add(key);
      if (!this.chunkViews.has(key)) {
        this.chunkViews.set(key, new ChunkView(key, chunk.cx, chunk.cy, this.tileLayer, this.lightLayer));
        chunk.visualDirty = true;
        chunk.lightDirty = true;
      }
    }
    for (const [key, view] of this.chunkViews) {
      if (!liveKeys.has(key)) {
        view.destroy();
        this.chunkViews.delete(key);
      }
    }

    // --- day bucket → global relight ---
    const bucket = Math.round(dayLight * 24);
    if (bucket !== this.lastDayBucket) {
      this.lastDayBucket = bucket;
      game.world.markAllLightDirty();
    }

    // --- budgeted rebakes (nearest chunks first) ---
    const tint = lightTint(dayLight, game.activeEvent);
    const sorted = [...game.world.chunks.values()].sort((a, b) => {
      const da = Math.abs(a.cx * CHUNK - px) + Math.abs(a.cy * CHUNK - py);
      const db = Math.abs(b.cx * CHUNK - px) + Math.abs(b.cy * CHUNK - py);
      return da - db;
    });
    let visualBudget = 3;
    let lightBudget = this.settings.lightBudget;
    for (const chunk of sorted) {
      const view = this.chunkViews.get(chunkKey(chunk.cx, chunk.cy));
      if (!view) continue;
      const visible =
        Math.abs(chunk.cx * CHUNK - px) < (LOAD_RADIUS_X + 1.5) * CHUNK &&
        Math.abs(chunk.cy * CHUNK - py) < (LOAD_RADIUS_Y + 1.5) * CHUNK;
      if (!visible) continue;
      if (chunk.visualDirty && visualBudget > 0) {
        visualBudget--;
        view.rebakeTiles(game.world, chunk);
      }
      if (chunk.lightDirty && lightBudget > 0) {
        lightBudget--;
        computeChunkLight(game.world, chunk, dayLight);
        view.rebakeLight(chunk, tint);
      }
    }

    // --- entities ---
    this.syncPlayer(game, pd, px, py, alpha);
    this.syncEntities(game, alpha);
    this.particleSys.update(dtReal);
    this.particleSys.enabled = this.settings.particles;

    // --- mining crack + reticle ---
    if (pd.mineProgress > 0 && pd.mineX >= 0) {
      this.crack.visible = true;
      this.crack.texture = crackTextures()[Math.min(3, Math.floor(pd.mineProgress * 4))];
      this.crack.position.set(pd.mineX * TILE, pd.mineY * TILE);
    } else {
      this.crack.visible = false;
    }
    const aimDist = Math.hypot(input.aimX - px, input.aimY - py);
    this.reticle.visible = aimDist < 8;
    this.reticle.position.set(Math.floor(input.aimX) * TILE, Math.floor(input.aimY) * TILE);

    // --- player glow (light aura accessories / nightvision) ---
    const aura = pd.accessories.slots.some((s) => s && s.key === 'lightCore') || game.player.statuses.some((s) => s.key === 'nightvision');
    this.glow.visible = true;
    this.glow.position.set(px * TILE, py * TILE);
    this.glow.alpha = aura ? 0.55 : 0.15;
    this.glow.scale.set(aura ? 3.2 : 1.6);

    // --- damage numbers ---
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const d = this.damageTexts[i];
      d.life -= dtReal;
      d.text.y += d.vy * dtReal;
      d.text.alpha = Math.min(1, d.life * 2);
      if (d.life <= 0) {
        d.text.visible = false;
        this.damageTexts.splice(i, 1);
      }
    }
  }

  private syncPlayer(game: Game, pd: PlayerData, px: number, py: number, _alpha: number): void {
    const p = game.player;
    if (!this.playerSprite) {
      const strip = humanoidStrip(`char:${pd.character.key}`, pd.character.appearance);
      const tex = stripTextures(`char:${pd.character.key}`, strip);
      this.playerSprite = new Sprite(tex[0]);
      this.playerSprite.anchor.set(0.5, 1);
      this.entityLayer.addChild(this.playerSprite);
      this.heldItem = new Sprite();
      this.heldItem.anchor.set(0.1, 0.9);
      this.entityLayer.addChild(this.heldItem);
    }
    const strip = humanoidStrip(`char:${pd.character.key}`, pd.character.appearance);
    const tex = stripTextures(`char:${pd.character.key}`, strip);
    let frame = 0;
    if (!p.onGround && p.inLiquid === 0) frame = 5;
    else if (Math.abs(p.vx) > 0.8) frame = 1 + (Math.floor(this.animT * 9) % 4);
    this.playerSprite.texture = tex[frame];
    this.playerSprite.position.set(px * TILE, (py + p.h) * TILE);
    this.playerSprite.scale.x = p.facing;
    this.playerSprite.visible = pd.respawnT <= 0;
    this.playerSprite.alpha = p.iframes > 0.2 ? 0.55 : 1;

    // Held item with swing animation.
    const slot = pd.inventory.get(pd.hotbarIndex);
    if (slot && this.heldItem) {
      if (slot.key !== this.heldItemKey) {
        this.heldItemKey = slot.key;
        const t = Texture.from(itemIconCanvas(slot.key));
        t.source.scaleMode = 'nearest';
        this.heldItem.texture = t;
      }
      this.heldItem.visible = this.playerSprite.visible;
      const swing = pd.swingT > 0 ? (0.35 - pd.swingT) / 0.35 : 1;
      const baseAngle = p.facing === 1 ? 0.6 : Math.PI - 0.6;
      const angle = pd.swingT > 0 ? pd.swingAngle - (1 - swing) * 1.6 * p.facing : baseAngle;
      this.heldItem.position.set((px + p.facing * 0.4) * TILE, (py + 0.1) * TILE);
      this.heldItem.rotation = angle + (p.facing === -1 ? Math.PI / 2 : 0);
      this.heldItem.scale.set(p.facing === 1 ? 1 : -1, 1);
    } else if (this.heldItem) {
      this.heldItem.visible = false;
      this.heldItemKey = '';
    }
  }

  private syncEntities(game: Game, alpha: number): void {
    const seen = new Set<number>();
    for (const e of game.entities) {
      if (e.dead) continue;
      seen.add(e.id);
      let view = this.entityViews.get(e.id);
      const stripKey = stripKeyFor(e);
      if (!view || view.stripKey !== stripKey) {
        view?.sprite.destroy();
        const sprite = new Sprite(texturesFor(e, stripKey)[0]);
        sprite.anchor.set(0.5, e.kind === 'enemy' || e.kind === 'npc' ? 1 : 0.5);
        this.entityLayer.addChild(sprite);
        view = { sprite, stripKey };
        this.entityViews.set(e.id, view);
      }
      const ex = lerp(e.px, e.x, alpha);
      const ey = lerp(e.py, e.y, alpha);
      const texs = texturesFor(e, stripKey);
      const sprite = view.sprite;
      switch (e.kind) {
        case 'enemy':
        case 'npc': {
          const frames = texs.length;
          let frame = 0;
          if (frames >= 6) {
            // humanoid strip
            frame = !e.onGround ? 5 : Math.abs(e.vx) > 0.6 ? 1 + (Math.floor(this.animT * 8) % 4) : 0;
          } else if (frames > 1) {
            frame = Math.floor(this.animT * 6 + e.id) % frames;
          }
          sprite.texture = texs[frame];
          sprite.position.set(ex * TILE, (ey + e.h) * TILE);
          const def = e.kind === 'enemy' ? enemyByKey(e.data.defKey) : null;
          const s = def ? def.scale : 1;
          sprite.scale.set(s * e.facing, s);
          sprite.alpha = e.iframes > 0.1 ? 0.6 : 1;
          break;
        }
        case 'projectile': {
          sprite.texture = texs[0];
          sprite.position.set(ex * TILE, ey * TILE);
          sprite.rotation = Math.atan2(e.vy, e.vx);
          break;
        }
        case 'drop': {
          sprite.texture = texs[0];
          const bob = Math.sin(this.animT * 3 + e.id) * 1.5;
          sprite.position.set(ex * TILE, ey * TILE + bob);
          sprite.scale.set(0.8);
          break;
        }
        default:
          sprite.position.set(ex * TILE, ey * TILE);
      }
    }
    for (const [id, view] of this.entityViews) {
      if (!seen.has(id)) {
        view.sprite.destroy();
        this.entityViews.delete(id);
      }
    }
  }

  private pushDamage(x: number, y: number, amount: number, crit: boolean, color: number): void {
    let entry = this.damageTexts.find((d) => !d.text.visible);
    if (!entry) {
      if (this.damageTexts.length > 40) return;
      const text = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: crit ? 9 : 7, fill: 0xffffff, stroke: { color: 0x000000, width: 2 } },
      });
      text.anchor.set(0.5);
      this.textLayer.addChild(text);
      entry = { text, vy: -18, life: 0.9 };
      this.damageTexts.push(entry);
    } else {
      this.damageTexts.splice(this.damageTexts.indexOf(entry), 1);
      this.damageTexts.push(entry);
    }
    entry.text.text = crit ? `${amount}!` : `${amount}`;
    entry.text.style.fill = color;
    entry.text.style.fontSize = crit ? 10 : 7;
    entry.text.visible = true;
    entry.text.alpha = 1;
    entry.text.position.set(x * TILE + (Math.random() - 0.5) * 8, y * TILE);
    entry.life = 0.9;
    entry.vy = -18;
  }

  /** Convert a client-pixel position to world tile coordinates. */
  screenToWorld(sx: number, sy: number): [number, number] {
    const p = this.worldRoot.toLocal({ x: sx, y: sy });
    return [p.x / TILE, p.y / TILE];
  }

  resize(): void {
    this.background.resize(this.app.screen.width, this.app.screen.height);
    this.weather.resize(this.app.screen.width, this.app.screen.height);
  }

  dispose(): void {
    this.detachGame();
    this.app.destroy(true, { children: true });
  }
}

function stripKeyFor(e: Entity): string {
  switch (e.kind) {
    case 'enemy': {
      const def = enemyByKey(e.data.defKey);
      return `enemy:${def.key}`;
    }
    case 'npc':
      return `npc:${e.data.defKey}`;
    case 'projectile':
      return `proj:${e.data.spec.look}:${e.data.spec.color}`;
    case 'drop':
      return `drop:${e.data.itemKey}`;
    default:
      return 'generic';
  }
}

function texturesFor(e: Entity, stripKey: string): Texture[] {
  const cached = frameTexCache.get(stripKey);
  if (cached) return cached;
  switch (e.kind) {
    case 'enemy': {
      const def = enemyByKey(e.data.defKey);
      const strip =
        def.plan === 'humanoid'
          ? creatureStrip('humanoid', def.key, def.color, def.color2 ?? 0xffffff)
          : creatureStrip(def.plan, def.key, def.color, def.color2 ?? 0xffffff);
      return stripTextures(stripKey, strip);
    }
    case 'npc': {
      const def = npcByKey(e.data.defKey);
      return stripTextures(stripKey, humanoidStrip(`npc:${def.key}`, def.appearance));
    }
    case 'projectile':
      return stripTextures(stripKey, projectileStrip(e.data.spec.look, e.data.spec.color));
    case 'drop': {
      const canvas = itemIconCanvas(e.data.itemKey);
      const t = Texture.from(canvas);
      t.source.scaleMode = 'nearest';
      frameTexCache.set(stripKey, [t]);
      return [t];
    }
    default: {
      const t = Texture.WHITE;
      frameTexCache.set(stripKey, [t]);
      return [t];
    }
  }
}

function lightTint(dayLight: number, event: string | null): [number, number, number] {
  // Warm days, blue nights, red static.
  const day: [number, number, number] = [1.0, 0.97, 0.9];
  const night: [number, number, number] = [0.72, 0.78, 1.05];
  let tint: [number, number, number] = [
    lerp(night[0], day[0], dayLight),
    lerp(night[1], day[1], dayLight),
    lerp(night[2], day[2], dayLight),
  ];
  if (event === 'crimsonStatic') tint = [tint[0] * 1.15, tint[1] * 0.6, tint[2] * 0.6];
  if (event === 'umbralVeil') tint = [tint[0] * 0.8, tint[1] * 0.7, tint[2] * 1.0];
  return tint;
}

let glowTex: Texture | null = null;
function glowTexture(): Texture {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,240,200,0.9)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    glowTex = Texture.from(c);
  }
  return glowTex;
}

/** Map colors for the minimap (UI reads this to paint explored tiles). */
export function mapColorOf(id: number): number {
  if (id === 0) return 0;
  return block(id).color;
}

export const AIR_ID = blockIdOpt('air') ?? 0;
