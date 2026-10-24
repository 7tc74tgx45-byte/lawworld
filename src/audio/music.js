// MusicManager (T15): procedural ambient music with the Web Audio API. No files, no network.
//
//   playRegion(regionId)  hub / contract / tort / public-law (a season name works too)
//   playEncounter()       low diminished drone, filter opening slowly
//   endEncounter()        back to the region theme that was playing before
//   stop()                fade out and stop scheduling
//   setVolume(0-1), mute(bool)
//
// Looping: each theme schedules one bar at a time; a timer queues the next bar before the current one ends, so there is
// never a gap. Changing theme fades the old track's gain to 0 and the new one up from 0, linearly over 2 seconds.
// Browsers keep an AudioContext suspended until a click or key press, so the first gesture starts the sound.

import { THEMES } from './themes.js';
import { themeForRegion, effectiveGain, clampVolume, CROSSFADE_SECONDS, DEFAULT_MUSIC_VOLUME } from '../logic/music.js';

const LOOKAHEAD = 2.5; // seconds of music queued ahead of the clock
const TICK_MS = 400;

export class MusicManager {
  /** createContext is injectable so the manager can be tested without a browser. */
  constructor({ createContext, setTimer = setInterval, clearTimer = clearInterval, gestureTarget } = {}) {
    this.createContext = createContext ?? (() => {
      const C = globalThis.AudioContext || globalThis.webkitAudioContext;
      return C ? new C() : null;
    });
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.gestureTarget = gestureTarget ?? (typeof window !== 'undefined' ? window : null);
    this.volume = DEFAULT_MUSIC_VOLUME;
    this.muted = false;
    this.ctx = null;
    this.master = null;
    this.tracks = []; // { name, gain, nextBar, nextTime, theme, fading }
    this.regionTheme = 'hub';
    this.inEncounter = false;
    this.current = null; // theme name that should be audible
    this.timer = null;
    this.gestureBound = false;
  }

  get themeName() {
    return this.current;
  }

  setVolume(v) {
    this.volume = clampVolume(v);
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
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(effectiveGain(this.volume, this.muted), t + 0.08);
  }

  playRegion(regionId) {
    this.regionTheme = themeForRegion(regionId);
    if (!this.inEncounter) this.switchTo(this.regionTheme);
  }

  playEncounter() {
    this.inEncounter = true;
    this.switchTo('encounter');
  }

  endEncounter() {
    if (!this.inEncounter) return;
    this.inEncounter = false;
    this.switchTo(this.regionTheme);
  }

  stop() {
    this.current = null;
    this.inEncounter = false;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const tr of this.tracks) this.fadeOut(tr, t);
    this.stopTimerSoon();
  }

  // ---- internals

  ensureContext() {
    if (this.ctx) return true;
    let ctx = null;
    try { ctx = this.createContext(); } catch { ctx = null; }
    if (!ctx) return false;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = effectiveGain(this.volume, this.muted);
    this.master.connect(ctx.destination);
    return true;
  }

  /** Resume a suspended context on the first user gesture (autoplay policy). */
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

  switchTo(name) {
    if (name === this.current) return;
    if (!THEMES[name] || !this.ensureContext()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.current = name;
    for (const tr of this.tracks) this.fadeOut(tr, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS);
    gain.connect(this.master);
    this.tracks.push({ name, gain, theme: THEMES[name], nextBar: 0, nextTime: now + 0.05, fading: false });

    if (ctx.state === 'suspended') {
      ctx.resume?.()?.catch?.(() => {});
      this.bindGesture();
    }
    this.pump();
    if (!this.timer) this.timer = this.setTimer(() => this.pump(), TICK_MS);
  }

  fadeOut(tr, now) {
    if (tr.fading) return;
    tr.fading = true;
    tr.gain.gain.cancelScheduledValues(now);
    tr.gain.gain.setValueAtTime(tr.gain.gain.value, now);
    tr.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_SECONDS);
    tr.endsAt = now + CROSSFADE_SECONDS + 0.1;
  }

  /** Queue bars that start within the lookahead window; drop tracks that finished fading. */
  pump() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const tr of this.tracks) {
      if (tr.fading) continue;
      while (tr.nextTime < now + LOOKAHEAD) {
        tr.theme.scheduleBar(ctx, tr.gain, tr.nextTime, tr.nextBar);
        tr.nextTime += tr.theme.barSeconds;
        tr.nextBar += 1;
      }
    }
    this.tracks = this.tracks.filter((tr) => {
      if (tr.fading && now >= tr.endsAt) {
        try { tr.gain.disconnect(); } catch { /* already gone */ }
        return false;
      }
      return true;
    });
    if (!this.tracks.length) this.stopTimerSoon();
  }

  stopTimerSoon() {
    if (this.timer && !this.tracks.some((t) => !t.fading)) {
      // keep the timer until the fading tracks are dropped, then clear it
      if (!this.tracks.length) {
        this.clearTimer(this.timer);
        this.timer = null;
      }
    }
  }
}

/** The game's single music player. */
export const music = new MusicManager();
