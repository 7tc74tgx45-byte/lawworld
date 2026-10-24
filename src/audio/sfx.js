// SFXManager (T18): every sound effect is synthesised with the Web Audio API. No files, no network.
//
//   sfx.play(name)   name: footstep-grass | footstep-stone | footstep-sand | footstep-snow | door-open | correct | wrong | fanfare
//   sfx.setVolume(0-1), sfx.mute(bool)
//
// The rules (names, terrain filters, note pitches, timings) live in src/logic/sfx.js and are unit-tested.
// Browsers keep an AudioContext suspended until a click or key press: a play() before that resumes the context and
// is dropped (a queue of old footsteps arriving all at once would sound wrong), so the next one is heard.

import {
  SFX_NAMES, TERRAIN_SOUND, FOOTSTEP_MS, DOOR_SWEEP, CHIME, THUD, FANFARE,
  clampSfxVolume, sfxGain, DEFAULT_SFX_VOLUME,
} from '../logic/sfx.js';

const FLOOR = 0.0001; // exponential ramps cannot reach 0

export class SFXManager {
  /** createContext is injectable so the manager can be tested without a browser. */
  constructor({ createContext, gestureTarget } = {}) {
    this.createContext = createContext ?? (() => {
      const C = globalThis.AudioContext || globalThis.webkitAudioContext;
      return C ? new C() : null;
    });
    this.gestureTarget = gestureTarget ?? (typeof window !== 'undefined' ? window : null);
    this.volume = DEFAULT_SFX_VOLUME;
    this.muted = false;
    this.ctx = null;
    this.master = null;
    this.noise = null; // one shared second of white noise
    this.reverb = null; // convolver for the fanfare
    this.gestureBound = false;
  }

  setVolume(v) {
    this.volume = clampSfxVolume(v);
    this.applyMaster();
  }

  mute(flag) {
    this.muted = !!flag;
    this.applyMaster();
  }

  applyMaster() {
    if (!this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(sfxGain(this.volume, this.muted), t);
  }

  /** Play one effect. Unknown names, a muted manager and a missing AudioContext are all silent no-ops. Returns true if scheduled. */
  play(name) {
    if (!SFX_NAMES.includes(name) || this.muted || this.volume <= 0) return false;
    if (!this.ensureContext()) return false;
    const ctx = this.ctx;
    if (ctx.state === 'suspended') {
      ctx.resume?.()?.catch?.(() => {});
      this.bindGesture();
      return false;
    }
    try {
      const t = ctx.currentTime + 0.005;
      if (name.startsWith('footstep-')) this.footstep(name.slice(9), t);
      else if (name === 'door-open') this.doorOpen(t);
      else if (name === 'correct') this.correct(t);
      else if (name === 'wrong') this.wrong(t);
      else this.fanfare(t);
      return true;
    } catch {
      return false; // a sound effect must never break the game
    }
  }

  // ---- internals

  ensureContext() {
    if (this.ctx) return true;
    let ctx = null;
    try { ctx = this.createContext(); } catch { ctx = null; }
    if (!ctx) return false;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = sfxGain(this.volume, this.muted);
    this.master.connect(ctx.destination);
    return true;
  }

  bindGesture() {
    if (this.gestureBound || !this.gestureTarget?.addEventListener) return;
    this.gestureBound = true;
    const go = () => {
      this.ctx?.resume?.();
      if (this.ctx?.state !== 'suspended') {
        for (const ev of ['pointerdown', 'keydown']) this.gestureTarget.removeEventListener(ev, go, true);
        this.gestureBound = false;
      }
    };
    for (const ev of ['pointerdown', 'keydown']) this.gestureTarget.addEventListener(ev, go, true);
  }

  /** One second of white noise, made once. */
  noiseBuffer() {
    if (this.noise) return this.noise;
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate || 44100));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate || 44100);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    return buf;
  }

  /** A decaying-noise impulse response, built in code, for the convolver reverb. */
  impulseResponse(seconds) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate || 44100;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
    return buf;
  }

  /** A burst of white noise through a filter with an exponential decay. */
  noiseBurst(t, { seconds, filter, freq, q = 1, peak, rate = 1 }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(FLOOR, t + seconds);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + seconds + 0.02);
  }

  /** A sine/triangle tone with a quick attack and an exponential decay. */
  tone(t, { type = 'sine', freq, seconds, peak, attack = 0.008, out = this.master }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(FLOOR, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(FLOOR, t + seconds);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + seconds + 0.02);
  }

  footstep(terrain, t) {
    const s = TERRAIN_SOUND[terrain] ?? TERRAIN_SOUND.grass;
    // a little random variation in pitch and level so walking does not sound like a machine
    this.noiseBurst(t, {
      seconds: FOOTSTEP_MS / 1000, filter: s.filter, freq: s.freq, q: s.q,
      peak: s.peak * (0.85 + Math.random() * 0.3), rate: 0.9 + Math.random() * 0.2,
    });
  }

  doorOpen(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(DOOR_SWEEP.from, t);
    o.frequency.exponentialRampToValueAtTime(DOOR_SWEEP.to, t + DOOR_SWEEP.seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(FLOOR, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.02);
    g.gain.linearRampToValueAtTime(FLOOR, t + DOOR_SWEEP.seconds);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + DOOR_SWEEP.seconds + 0.02);
  }

  correct(t) {
    for (const freq of CHIME.notes) this.tone(t, { freq, seconds: CHIME.seconds, peak: 0.25, attack: 0.01 });
  }

  wrong(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(THUD.hz, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(FLOOR, t + THUD.seconds);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + THUD.seconds + 0.02);
    this.noiseBurst(t, { seconds: THUD.noiseSeconds, filter: 'lowpass', freq: 500, q: 0.7, peak: 0.6 });
  }

  fanfare(t) {
    const ctx = this.ctx;
    if (!this.reverb) {
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.impulseResponse(FANFARE.reverbSeconds);
      const wet = ctx.createGain();
      wet.gain.value = 0.55;
      this.reverb.connect(wet);
      wet.connect(this.master);
    }
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(this.master); // dry
    bus.connect(this.reverb); // wet
    FANFARE.notes.forEach((freq, i) => {
      const last = i === FANFARE.notes.length - 1;
      this.tone(t + i * FANFARE.noteSeconds, {
        type: 'triangle', freq, peak: 0.3, attack: 0.01, out: bus,
        seconds: last ? FANFARE.noteSeconds + FANFARE.tailSeconds : FANFARE.noteSeconds * 1.6,
      });
    });
  }
}

/** The game's single sound-effect player. */
export const sfx = new SFXManager();
