/**
 * Session: owns the live Game + Renderer + rAF loop, bridges bus → UI store /
 * audio, autosaves, and exposes commands for React (start/load/save/quit…).
 */

import { AUTOSAVE_INTERVAL } from '../data/constants';
import { Game } from '../game/game';
import type { InputState, PlayerData } from '../game/sim';
import { Renderer } from '../render/renderer';
import { input } from '../input/input';
import { audio } from '../audio/engine';
import { ambient, music } from '../audio/music';
import { saveWorld, loadWorld } from '../save/saves';
import { EVENT_NAMES, currentBiomeKey } from '../game/worldEvents';
import { bumpInventory, getUI, pushBanner, setUI } from './store';

export interface Session {
  game: Game;
  renderer: Renderer;
  worldId: string;
  worldName: string;
}

let session: Session | null = null;
let rafId = 0;
let lastTime = 0;
let hudT = 0;
let autosaveT = 0;
let fpsAcc = 0;
let fpsN = 0;
let rendererSingleton: Renderer | null = null;

export function currentSession(): Session | null {
  return session;
}

export async function ensureRenderer(parent: HTMLElement): Promise<Renderer> {
  if (!rendererSingleton) {
    rendererSingleton = await Renderer.create(parent);
    window.addEventListener('resize', () => rendererSingleton?.resize());
  }
  return rendererSingleton;
}

export async function startNewGame(parent: HTMLElement, name: string, seedText: string, characterKey: string): Promise<void> {
  setUI({ loading: 'Folding the lattice…' });
  const renderer = await ensureRenderer(parent);
  const game = new Game({ seedText: seedText || `${Date.now()}`, characterKey });
  beginSession(renderer, game, `world-${Date.now().toString(36)}`, name || 'New World');
}

export async function loadGame(parent: HTMLElement, id: string, name: string): Promise<void> {
  setUI({ loading: 'Recalling the strata…' });
  const renderer = await ensureRenderer(parent);
  const loaded = await loadWorld(id);
  if (!loaded) {
    setUI({ loading: null });
    pushBanner('Save could not be loaded');
    return;
  }
  const game = new Game({
    seedText: loaded.state.seedText,
    characterKey: loaded.state.characterKey,
    saved: loaded.state,
  });
  loaded.applyChunks(game);
  beginSession(renderer, game, id, name);
}

function beginSession(renderer: Renderer, game: Game, worldId: string, worldName: string): void {
  endSession(false);
  session = { game, renderer, worldId, worldName };
  music.setSeed(game.seedText);
  renderer.attachGame(game);
  wireBus(game);
  setUI({ screen: 'playing', panel: null, loading: null, bossBar: null, chest: null, dialogueNpc: null });
  lastTime = performance.now();
  autosaveT = 0;
  rafId = requestAnimationFrame(frame);
}

export async function saveNow(): Promise<void> {
  if (!session) return;
  await saveWorld(session.game, session.worldId, session.worldName);
  pushBanner('World saved');
}

export async function quitToMenu(): Promise<void> {
  if (!session) return;
  await saveWorld(session.game, session.worldId, session.worldName).catch(() => pushBanner('Autosave failed'));
  endSession(true);
  setUI({ screen: 'menu', panel: null, bossBar: null, chest: null, dialogueNpc: null });
}

function endSession(dispose: boolean): void {
  cancelAnimationFrame(rafId);
  if (session && dispose) {
    session.renderer.detachGame();
    session.game.dispose();
  }
  session = null;
}

function wireBus(game: Game): void {
  const px = () => game.player.x;
  game.bus.on('sound', ({ key, x }) => {
    const dx = x === undefined ? 0 : x - px();
    const att = x === undefined ? 1 : Math.max(0, 1 - Math.abs(dx) / 40);
    audio.sfx(key, dx / 30, att);
  });
  game.bus.on('banner', ({ title, sub, color }) => pushBanner(title, sub, color));
  game.bus.on('bossBar', (bar) => setUI({ bossBar: bar }));
  game.bus.on('openChest', (chest) => {
    setUI({ chest, panel: chest ? 'inventory' : getUI().panel });
    if (chest) audio.sfx('uiOpen');
  });
  game.bus.on('dialogue', (d) => setUI({ dialogueNpc: d ? d.npcKey : null }));
  game.bus.on('musicCue', ({ key }) => music.cue(key));
  game.bus.on('pickup', () => bumpInventory());
  game.bus.on('crafted', () => bumpInventory());
  game.bus.on('eventStarted', () => syncHud(game));
  game.bus.on('portalUsed', () => syncHud(game));
}

function frame(now: number): void {
  if (!session) return;
  const { game, renderer } = session;
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  const ui = getUI();
  const paused = ui.panel === 'pause' || ui.panel === 'settings';
  game.paused = paused;
  input.uiCapture = ui.panel !== null || ui.dialogueNpc !== null || ui.chest !== null || ui.hud.dead;

  const pd = game.player.data as PlayerData;
  const inputState: InputState = input.getState(
    (sx, sy) => renderer.screenToWorld(sx, sy),
    [game.player.x, game.player.y],
    pd.hotbarIndex,
  );
  game.update(dt, inputState);
  renderer.render(game, inputState, game.interpolationAlpha, dt);

  // Audio direction.
  music.update();
  music.ambientCue(game.dimKey, game.isNight());
  const underground = game.player.y > game.surfaceAt(Math.floor(game.player.x)) + 20;
  ambient.update(game.weather, underground, game.isNight());

  // HUD sync at 10 Hz.
  hudT -= dt;
  fpsAcc += dt;
  fpsN++;
  if (hudT <= 0) {
    hudT = 0.1;
    syncHud(game);
    if (fpsAcc > 0.5) {
      setUI({ fps: Math.round(fpsN / fpsAcc) });
      fpsAcc = 0;
      fpsN = 0;
    }
  }

  // Autosave.
  autosaveT += dt;
  if (autosaveT >= AUTOSAVE_INTERVAL) {
    autosaveT = 0;
    void saveWorld(game, session.worldId, session.worldName).catch(() => pushBanner('Autosave failed'));
  }

  rafId = requestAnimationFrame(frame);
}

function syncHud(game: Game): void {
  const pd = game.player.data as PlayerData;
  setUI({
    hud: {
      hp: Math.max(0, Math.round(game.player.hp)),
      maxHp: game.player.maxHp,
      mana: Math.round(pd.mana),
      maxMana: pd.maxMana,
      stamina: Math.round(pd.stamina),
      maxStamina: pd.maxStamina,
      hunger: Math.round(pd.hunger),
      breath: Math.round(pd.breath),
      temperature: Math.round(pd.temperature),
      coins: pd.coins,
      hotbarIndex: pd.hotbarIndex,
      hotbar: pd.inventory.slots.slice(0, 10).map((s) => (s ? { ...s } : null)),
      buffs: game.player.statuses.map((s) => ({ key: s.key, t: Math.round(s.t) })),
      timeOfDay: game.timeOfDay,
      day: game.day,
      depth: Math.round(game.player.y),
      biome: currentBiomeKey(game),
      dead: pd.respawnT > 0,
      weather: game.weather,
      eventName: game.activeEvent ? EVENT_NAMES[game.activeEvent] : null,
    },
  });
}

/** Save on tab hide — cheap insurance against closed tabs. */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && session) {
      void saveWorld(session.game, session.worldId, session.worldName).catch(() => undefined);
    }
  });
}
