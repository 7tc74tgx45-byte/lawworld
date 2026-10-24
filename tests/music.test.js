import test from 'node:test';
import assert from 'node:assert/strict';
import {
  themeForRegion, midiToHz, clampVolume, effectiveGain, arpeggioBar, CONTRACT_CHORDS, tensionCutoff, CUTOFF_LOW, CUTOFF_HIGH,
  winterFifth, ENCOUNTER_CHORD, TORT_DRONE, DEFAULT_MUSIC_VOLUME,
} from '../src/logic/music.js';
import { MusicManager } from '../src/audio/music.js';
import { THEMES } from '../src/audio/themes.js';
import { DEFAULT_SETTINGS } from '../src/settings.js';

test('regions and seasons map to themes; unknown falls back to the hub', () => {
  assert.equal(themeForRegion('contract'), 'contract');
  assert.equal(themeForRegion('tort'), 'tort');
  assert.equal(themeForRegion('public-law'), 'publicLaw');
  assert.equal(themeForRegion('foundations'), 'hub');
  assert.equal(themeForRegion('winter'), 'publicLaw');
  assert.equal(themeForRegion('nowhere'), 'hub');
});

test('pitch and volume maths', () => {
  assert.equal(midiToHz(69), 440);
  assert.ok(Math.abs(midiToHz(60) - 261.6256) < 0.001);
  assert.equal(clampVolume(2), 1);
  assert.equal(clampVolume(-1), 0);
  assert.equal(clampVolume('abc'), DEFAULT_MUSIC_VOLUME);
  assert.equal(effectiveGain(1, true), 0);
  assert.equal(effectiveGain(0, false), 0);
  assert.ok(effectiveGain(0.5, false) < effectiveGain(1, false));
});

test('contract arpeggio stays in C major (white notes only), eight notes a bar', () => {
  const white = new Set([0, 2, 4, 5, 7, 9, 11]);
  for (let bar = 0; bar < CONTRACT_CHORDS.length; bar++) {
    const notes = arpeggioBar(bar);
    assert.equal(notes.length, 8);
    for (const n of notes) assert.ok(white.has(n.midi % 12), `midi ${n.midi} is not in C major`);
  }
});

test('winter uses open fifths (seven semitones, no third)', () => {
  for (let bar = 0; bar < 4; bar++) {
    const [a, b] = winterFifth(bar);
    assert.equal(b - a, 7);
  }
});

test('encounter chord is a diminished seventh (stacked minor thirds)', () => {
  for (let i = 1; i < ENCOUNTER_CHORD.length; i++) assert.equal(ENCOUNTER_CHORD[i] - ENCOUNTER_CHORD[i - 1], 3);
});

test('tort drone is A minor (A and E)', () => {
  assert.equal(TORT_DRONE.low % 12, 9);
  assert.equal(TORT_DRONE.fifth % 12, 4);
});

test('tension cutoff rises across bars, is continuous, and stays in range', () => {
  let prevTo = null;
  for (let bar = 0; bar < 16; bar++) {
    const { from, to } = tensionCutoff(bar);
    assert.ok(from >= CUTOFF_LOW - 1e-6 && to <= CUTOFF_HIGH + 1e-6);
    if (prevTo !== null) assert.ok(Math.abs(from - prevTo) < 1e-6, 'sweep must be continuous between bars');
    prevTo = to;
  }
  assert.ok(tensionCutoff(5).to > tensionCutoff(0).from * 5);
});

test('music settings have defaults', () => {
  assert.equal(typeof DEFAULT_SETTINGS.musicVolume, 'number');
  assert.equal(DEFAULT_SETTINGS.musicMuted, false);
});

// ---- A fake AudioContext, enough to run the real schedulers.
function fakeContext() {
  const param = (v = 0) => ({
    value: v,
    calls: [],
    setValueAtTime(x, t) { this.calls.push(['set', x, t]); this.value = x; },
    linearRampToValueAtTime(x, t) { this.calls.push(['ramp', x, t]); },
    exponentialRampToValueAtTime(x, t) { this.calls.push(['exp', x, t]); },
    cancelScheduledValues() {},
  });
  const node = (extra = {}) => ({ connect() {}, disconnect() {}, start() { this.started = true; }, stop() {}, ...extra });
  const ctx = {
    currentTime: 0,
    state: 'running',
    destination: node(),
    gains: [],
    oscillators: [],
    createGain() { const n = node({ gain: param(1) }); ctx.gains.push(n); return n; },
    createOscillator() { const n = node({ frequency: param(440), detune: param(0), type: 'sine' }); ctx.oscillators.push(n); return n; },
    createBiquadFilter() { return node({ frequency: param(1000), Q: param(1), type: 'lowpass' }); },
    resume() { return Promise.resolve(); },
  };
  return ctx;
}

function manager() {
  const ctx = fakeContext();
  let tick = null;
  const m = new MusicManager({
    createContext: () => ctx,
    setTimer: (fn) => { tick = fn; return 1; },
    clearTimer: () => { tick = null; },
    gestureTarget: null,
  });
  return { m, ctx, tick: () => tick?.() };
}

test('every theme schedules a bar of sound with the fake context', () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    const ctx = fakeContext();
    const out = ctx.createGain();
    theme.scheduleBar(ctx, out, 0, 0);
    assert.ok(ctx.oscillators.length > 0, `${name} made no oscillators`);
    assert.ok(theme.barSeconds > 0);
  }
});

test('themes use the oscillator types the brief asks for', () => {
  const types = (name) => {
    const ctx = fakeContext();
    THEMES[name].scheduleBar(ctx, ctx.createGain(), 0, 0);
    return new Set(ctx.oscillators.map((o) => o.type));
  };
  assert.ok(types('contract').has('triangle') && types('contract').has('sawtooth'));
  assert.ok(types('tort').has('sawtooth'));
  assert.deepEqual([...types('publicLaw')], ['sine']);
  assert.ok(types('hub').has('sine') && types('hub').has('triangle'));
  assert.ok(types('encounter').has('sawtooth'));
});

test('looping: the next bar is queued before the current one ends', () => {
  const { m, ctx, tick } = manager();
  m.playRegion('contract');
  const bar = THEMES.contract.barSeconds; // 2 s at 120 BPM
  assert.equal(bar, 2);
  const countAt = () => ctx.oscillators.length;
  const first = countAt();
  assert.ok(first > 0);
  // the first pump already queued bars starting at 0.05 s and 2.05 s (inside the 2.5 s lookahead)
  assert.ok(m.tracks[0].nextTime > bar, 'second bar queued before the first has finished');
  ctx.currentTime = 2; // the clock reaches the second bar: the third must be queued now
  tick();
  assert.ok(countAt() > first, 'next bar must be scheduled ahead of time');
  const before = countAt();
  tick(); // nothing new until time advances
  assert.equal(countAt(), before);
  const track = m.tracks[0];
  assert.ok(track.nextTime > ctx.currentTime + 2, 'queue should run ahead of the clock');
});

test('crossfade: old track ramps to 0 and new ramps up over 2 seconds', () => {
  const { m, ctx } = manager();
  m.playRegion('contract');
  ctx.currentTime = 10;
  m.playRegion('tort');
  assert.equal(m.themeName, 'tort');
  assert.equal(m.tracks.length, 2);
  const [oldT, newT] = m.tracks;
  const lastRamp = (t) => t.gain.gain.calls.filter((c) => c[0] === 'ramp').pop();
  assert.deepEqual(lastRamp(oldT).slice(1), [0, 12]);
  const up = newT.gain.gain.calls.find((c) => c[0] === 'ramp');
  assert.deepEqual(up.slice(1), [1, 12]);
  assert.deepEqual(newT.gain.gain.calls[0], ['set', 0, 10]);
  // after the fade the old track is dropped and stops scheduling
  ctx.currentTime = 13;
  m.pump();
  assert.equal(m.tracks.length, 1);
  assert.equal(m.tracks[0].name, 'tort');
});

test('same theme twice does not restart or stack', () => {
  const { m } = manager();
  m.playRegion('tort');
  m.playRegion('tort');
  assert.equal(m.tracks.length, 1);
});

test('encounter replaces the region theme, region changes during it wait, closing returns to the latest region', () => {
  const { m } = manager();
  m.playRegion('contract');
  m.playEncounter();
  assert.equal(m.themeName, 'encounter');
  m.playRegion('tort'); // e.g. a client conversation while the region changes: remembered, not played
  assert.equal(m.themeName, 'encounter');
  m.endEncounter();
  assert.equal(m.themeName, 'tort');
  m.endEncounter(); // harmless when not in an encounter
  assert.equal(m.themeName, 'tort');
});

test('volume and mute drive the master gain; stop fades everything out', () => {
  const { m, ctx } = manager();
  m.setVolume(0.8);
  m.mute(true);
  m.playRegion('hub');
  assert.equal(m.master.gain.value, 0);
  m.mute(false);
  const last = m.master.gain.calls.filter((c) => c[0] === 'ramp').pop();
  assert.equal(last[1], effectiveGain(0.8, false));
  m.stop();
  assert.equal(m.themeName, null);
  assert.ok(m.tracks.every((t) => t.fading));
  ctx.currentTime = 5;
  m.pump();
  assert.equal(m.tracks.length, 0);
});

test('no AudioContext available: the manager stays silent without throwing', () => {
  const m = new MusicManager({ createContext: () => null, gestureTarget: null });
  assert.doesNotThrow(() => { m.playRegion('contract'); m.playEncounter(); m.endEncounter(); m.setVolume(0.3); m.mute(true); m.stop(); });
});
