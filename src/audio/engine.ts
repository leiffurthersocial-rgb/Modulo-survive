/**
 * Procedural WebAudio: synthesized SFX, generative chiptune music and ambient
 * beds — zero audio assets. Positional panning by world-x distance.
 */

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  volumes = { master: 0.8, music: 0.5, sfx: 0.8, ambient: 0.5 };
  private unlocked = false;

  /** Browsers require a user gesture; call from any input handler. */
  unlock(): void {
    if (this.unlocked) return;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.ambientBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.ambientBus.connect(this.master);
      this.applyVolumes();
      this.unlocked = true;
    } catch {
      this.ctx = null;
    }
  }

  applyVolumes(): void {
    if (!this.master) return;
    this.master.gain.value = this.volumes.master;
    this.musicBus!.gain.value = this.volumes.music;
    this.sfxBus!.gain.value = this.volumes.sfx;
    this.ambientBus!.gain.value = this.volumes.ambient;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }
  get music(): GainNode | null {
    return this.musicBus;
  }
  get ambient(): GainNode | null {
    return this.ambientBus;
  }

  /** Fire a synthesized effect. pan/att from world distance (listener at 0). */
  sfx(key: string, pan = 0, att = 1): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || att <= 0.02) return;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    out.connect(panner);
    panner.connect(bus);

    const osc = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t + delay);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + delay + dur);
      g.gain.setValueAtTime(vol * att, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
      o.connect(g);
      g.connect(out);
      o.start(t + delay);
      o.stop(t + delay + dur + 0.02);
    };
    const noise = (dur: number, vol: number, filterFreq = 2000, delay = 0) => {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq;
      const g = ctx.createGain();
      g.gain.value = vol * att;
      src.connect(f);
      f.connect(g);
      g.connect(out);
      src.start(t + delay);
    };

    switch (key) {
      case 'dig': noise(0.08, 0.25, 900); break;
      case 'chop': noise(0.1, 0.3, 1400); osc('square', 180, 90, 0.08, 0.08); break;
      case 'break': noise(0.16, 0.4, 1200); osc('triangle', 220, 60, 0.12, 0.1); break;
      case 'place': osc('triangle', 320, 180, 0.08, 0.2); break;
      case 'clink': osc('square', 1200, 900, 0.05, 0.12); break;
      case 'jump': osc('sine', 300, 500, 0.12, 0.15); break;
      case 'thud': noise(0.12, 0.4, 400); break;
      case 'swing': noise(0.09, 0.12, 3500); break;
      case 'hit': noise(0.08, 0.3, 2000); osc('square', 300, 120, 0.08, 0.15); break;
      case 'hurt': osc('sawtooth', 260, 120, 0.14, 0.2); break;
      case 'hurtPlayer': osc('sawtooth', 200, 80, 0.2, 0.3); noise(0.1, 0.2, 800); break;
      case 'die': osc('sawtooth', 300, 50, 0.35, 0.25); break;
      case 'playerDie': osc('sawtooth', 400, 40, 0.8, 0.3); noise(0.5, 0.3, 600); break;
      case 'bossDie': osc('sawtooth', 200, 30, 1.2, 0.4); noise(0.9, 0.5, 500); break;
      case 'pickup': osc('sine', 700, 1100, 0.09, 0.15); break;
      case 'coin': osc('square', 1000, 1400, 0.06, 0.1); osc('square', 1400, 1800, 0.08, 0.08, 0.05); break;
      case 'craft': osc('triangle', 500, 700, 0.1, 0.15); osc('triangle', 700, 900, 0.12, 0.12, 0.08); break;
      case 'eat': noise(0.12, 0.2, 700); break;
      case 'drink': osc('sine', 400, 250, 0.15, 0.15); noise(0.08, 0.1, 900, 0.05); break;
      case 'bow': noise(0.06, 0.15, 2600); osc('sine', 500, 900, 0.07, 0.1); break;
      case 'cast': osc('sine', 800, 1300, 0.14, 0.15); osc('sine', 1200, 700, 0.1, 0.1, 0.05); break;
      case 'fizzle': osc('sine', 300, 150, 0.15, 0.1); break;
      case 'summon': osc('triangle', 200, 600, 0.4, 0.2); break;
      case 'impact': noise(0.05, 0.18, 1800); break;
      case 'door': noise(0.09, 0.2, 500); osc('square', 120, 80, 0.08, 0.08); break;
      case 'splash': noise(0.2, 0.3, 1000); break;
      case 'dodge': noise(0.08, 0.15, 4000); break;
      case 'hop': osc('sine', 200, 350, 0.08, 0.08); break;
      case 'screech': osc('sawtooth', 1200, 700, 0.18, 0.1); break;
      case 'spit': noise(0.07, 0.15, 1500); break;
      case 'turret': osc('square', 600, 300, 0.09, 0.12); break;
      case 'teleport': osc('sine', 1400, 200, 0.25, 0.2); break;
      case 'portal': osc('sine', 100, 800, 0.7, 0.25); osc('sine', 150, 900, 0.7, 0.15, 0.1); break;
      case 'thunder': noise(1.4, 0.6, 300); noise(0.3, 0.5, 1200); break;
      case 'rumble': noise(0.8, 0.3, 200); break;
      case 'meteor': osc('sawtooth', 900, 100, 0.8, 0.15); noise(0.5, 0.2, 700, 0.3); break;
      case 'slam': noise(0.25, 0.5, 350); break;
      case 'dash': noise(0.15, 0.2, 2600); break;
      case 'radial': osc('triangle', 500, 200, 0.3, 0.2); break;
      case 'rainAtk': noise(0.3, 0.2, 1800); break;
      case 'quest': osc('triangle', 600, 900, 0.15, 0.2); osc('triangle', 900, 1200, 0.2, 0.18, 0.12); break;
      case 'reward': osc('triangle', 700, 1000, 0.12, 0.2); osc('triangle', 1000, 1400, 0.2, 0.18, 0.1); break;
      case 'extract': osc('square', 250, 400, 0.1, 0.08); break;
      case 'uiClick': osc('square', 800, 600, 0.04, 0.08); break;
      case 'uiOpen': osc('sine', 500, 800, 0.08, 0.1); break;
      default: osc('sine', 440, 330, 0.08, 0.08);
    }
  }
}

export const audio = new AudioEngine();
