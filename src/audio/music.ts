/**
 * Generative chiptune sequencer: per-dimension scales/tempo/timbre with
 * day/night/boss/danger variants. Composes bars on the fly from a seeded RNG
 * so each world's soundtrack is unique but coherent.
 */

import { RNG, hashString } from '../core/rng';
import { audio } from './engine';

interface MusicMood {
  scale: number[]; // semitone offsets
  root: number; // MIDI note
  bpm: number;
  wave: OscillatorType;
  bassWave: OscillatorType;
  density: number; // 0..1 note probability
  minor?: boolean;
}

const MOODS: Record<string, MusicMood> = {
  keystone: { scale: [0, 2, 4, 7, 9], root: 57, bpm: 92, wave: 'triangle', bassWave: 'sine', density: 0.55 },
  keystoneNight: { scale: [0, 3, 5, 7, 10], root: 52, bpm: 76, wave: 'sine', bassWave: 'sine', density: 0.4 },
  ancient: { scale: [0, 2, 3, 7, 8], root: 50, bpm: 84, wave: 'triangle', bassWave: 'triangle', density: 0.5 },
  crystal: { scale: [0, 2, 4, 6, 9, 11], root: 62, bpm: 88, wave: 'sine', bassWave: 'sine', density: 0.6 },
  frozen: { scale: [0, 2, 3, 7, 10], root: 55, bpm: 68, wave: 'sine', bassWave: 'sine', density: 0.35 },
  molten: { scale: [0, 1, 4, 5, 7, 8], root: 45, bpm: 100, wave: 'sawtooth', bassWave: 'square', density: 0.6 },
  machine: { scale: [0, 2, 3, 5, 7, 10], root: 48, bpm: 112, wave: 'square', bassWave: 'square', density: 0.65 },
  sky: { scale: [0, 2, 4, 7, 11], root: 64, bpm: 96, wave: 'triangle', bassWave: 'sine', density: 0.5 },
  void: { scale: [0, 1, 5, 6, 10], root: 43, bpm: 60, wave: 'sine', bassWave: 'sine', density: 0.28 },
  boss: { scale: [0, 1, 4, 5, 7, 8, 11], root: 45, bpm: 132, wave: 'sawtooth', bassWave: 'square', density: 0.8 },
  danger: { scale: [0, 1, 3, 5, 7, 8], root: 47, bpm: 118, wave: 'square', bassWave: 'sawtooth', density: 0.7 },
  event: { scale: [0, 2, 3, 7, 9], root: 52, bpm: 104, wave: 'triangle', bassWave: 'triangle', density: 0.6 },
  victory: { scale: [0, 4, 7, 12], root: 60, bpm: 120, wave: 'triangle', bassWave: 'sine', density: 0.9 },
};

const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class MusicDirector {
  private mood = 'keystone';
  private rng = new RNG(hashString('music'));
  private nextBarAt = 0;
  private bar = 0;
  private stopped = false;
  enabled = true;

  setSeed(seedText: string): void {
    this.rng = new RNG(hashString(`music:${seedText}`));
  }

  cue(key: string): void {
    if (MOODS[key]) this.mood = key;
    else if (MOODS[`${key}`] === undefined && key === 'keystoneDay') this.mood = 'keystone';
  }

  /** Choose ambient mood from game state (called when no hard cue plays). */
  ambientCue(dimKey: string, night: boolean): void {
    if (this.mood === 'boss' || this.mood === 'danger' || this.mood === 'victory') return;
    this.mood = dimKey === 'overworld' ? (night ? 'keystoneNight' : 'keystone') : MOODS[dimKey] ? dimKey : 'keystone';
  }

  releaseCue(): void {
    this.mood = 'keystone';
  }

  update(): void {
    if (!this.enabled || this.stopped) return;
    const ctx = audio.context;
    const bus = audio.music;
    if (!ctx || !bus) return;
    const now = ctx.currentTime;
    if (now < this.nextBarAt - 0.05) return;

    const mood = MOODS[this.mood] ?? MOODS.keystone;
    const beat = 60 / mood.bpm;
    const barLen = beat * 4;
    const start = Math.max(now, this.nextBarAt);
    this.nextBarAt = start + barLen;
    this.bar++;

    // Chord roots cycle a simple progression.
    const prog = [0, 0, -4, -2];
    const chordRoot = mood.root + prog[this.bar % 4];

    // Bass: one note per beat.
    for (let b = 0; b < 4; b++) {
      if (this.rng.next() < 0.85) {
        this.note(ctx, bus, mood.bassWave, midiHz(chordRoot - 12), start + b * beat, beat * 0.9, 0.16);
      }
    }
    // Lead: eighth notes from the scale.
    for (let s = 0; s < 8; s++) {
      if (this.rng.next() > mood.density) continue;
      const deg = mood.scale[this.rng.int(0, mood.scale.length - 1)];
      const oct = this.rng.chance(0.2) ? 12 : 0;
      this.note(ctx, bus, mood.wave, midiHz(chordRoot + deg + oct), start + s * beat * 0.5, beat * 0.48, 0.09);
    }
    // Sparkle arp on some bars.
    if (this.bar % 4 === 3 && this.rng.chance(0.7)) {
      for (let s = 0; s < 4; s++) {
        const deg = mood.scale[s % mood.scale.length];
        this.note(ctx, bus, 'sine', midiHz(chordRoot + deg + 12), start + s * beat * 0.25 + beat * 2, beat * 0.22, 0.05);
      }
    }
    // Percussion: noise hats.
    for (let s = 0; s < 8; s++) {
      if (s % 2 === 0 || this.rng.chance(0.3)) {
        this.hat(ctx, bus, start + s * beat * 0.5, s % 4 === 0 ? 0.09 : 0.04);
      }
    }
  }

  private note(ctx: AudioContext, bus: GainNode, wave: OscillatorType, freq: number, t: number, dur: number, vol: number): void {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private hat(ctx: AudioContext, bus: GainNode, t: number, vol: number): void {
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(t);
  }

  stop(): void {
    this.stopped = true;
  }
  resume(): void {
    this.stopped = false;
  }
}

export const music = new MusicDirector();

/** Ambient beds: wind / rain / cave drip loops, crossfaded by state. */
export class AmbientDirector {
  private nodes: { src: AudioBufferSourceNode; gain: GainNode; key: string }[] = [];
  private current = '';

  update(weather: string, underground: boolean, night: boolean): void {
    const key = underground ? 'cave' : weather === 'rain' || weather === 'storm' ? 'rain' : night ? 'nightWind' : 'wind';
    if (key === this.current) return;
    this.current = key;
    const ctx = audio.context;
    const bus = audio.ambient;
    if (!ctx || !bus) return;
    // Fade out old beds.
    for (const n of this.nodes) {
      n.gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      n.src.stop(ctx.currentTime + 1.4);
    }
    this.nodes = [];
    // New looped noise bed.
    const dur = 3;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // Pink-ish noise via leaky integrator.
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
      d[i] = last * 8;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = key === 'rain' ? 2400 : key === 'cave' ? 300 : 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(key === 'rain' ? 0.5 : 0.3, ctx.currentTime + 1.5);
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start();
    this.nodes.push({ src, gain: g, key });
  }
}

export const ambient = new AmbientDirector();
