import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SFX_NAMES, TERRAIN_SOUND, FOOTSTEP_MS, FOOTSTEP_INTERVAL_MS, footstepName, terrainAt, createStepper, tickStepper,
  evaluationSound, sfxGain, clampSfxVolume, DEFAULT_SFX_VOLUME, DOOR_SWEEP, CHIME, THUD, FANFARE, NOTE_HZ,
} from '../src/logic/sfx.js';
import { SFXManager } from '../src/audio/sfx.js';
import { DEFAULT_SETTINGS } from '../src/settings.js';
import { buildWorld } from '../src/logic/layout.js';
import { curriculum } from '../src/data/curriculum.js';
import { TILE, TILE_SIZE, tileAt } from '../src/logic/worldQuery.js';

test('the eight effect names are exactly the ones the brief lists', () => {
  assert.deepEqual([...SFX_NAMES].sort(), [
    'correct', 'door-open', 'fanfare', 'footstep-grass', 'footstep-sand', 'footstep-snow', 'footstep-stone', 'wrong',
  ]);
});

test('footstep filters: grass 200 Hz, stone 800 Hz, sand 100 Hz, snow 1.2 kHz; burst is 80 ms', () => {
  assert.equal(TERRAIN_SOUND.grass.freq, 200);
  assert.equal(TERRAIN_SOUND.stone.freq, 800);
  assert.equal(TERRAIN_SOUND.sand.freq, 100);
  assert.equal(TERRAIN_SOUND.snow.freq, 1200);
  assert.equal(FOOTSTEP_MS, 80);
  assert.equal(footstepName('snow'), 'footstep-snow');
  assert.equal(footstepName('lava'), 'footstep-grass');
});

test('tone constants match the brief', () => {
  assert.deepEqual([DOOR_SWEEP.from, DOOR_SWEEP.to, DOOR_SWEEP.seconds], [300, 900, 0.2]);
  assert.equal(CHIME.seconds, 0.4);
  assert.deepEqual(CHIME.notes, [NOTE_HZ.C5, NOTE_HZ.E5]);
  assert.ok(Math.abs(NOTE_HZ.E5 / NOTE_HZ.C5 - Math.pow(2, 4 / 12)) < 0.003, 'E5 is a major third above C5');
  assert.equal(THUD.hz, 80);
  assert.equal(THUD.seconds, 0.15);
  assert.deepEqual(FANFARE.notes, [NOTE_HZ.C4, NOTE_HZ.E4, NOTE_HZ.G4, NOTE_HZ.C5]);
  assert.equal(FANFARE.noteSeconds, 0.1);
});

test('stepper: first step at once, then one per 400 ms while walking; standing still makes none', () => {
  const s = createStepper();
  assert.equal(tickStepper(s, 16, true), true);
  let steps = 0;
  for (let t = 0; t < 2000; t += 16) if (tickStepper(s, 16, true)) steps++;
  assert.ok(steps >= 4 && steps <= 5, `got ${steps} steps in 2 s`);
  assert.equal(tickStepper(s, 1000, false), false);
  // starting again after standing still: immediate step, but tapping cannot machine-gun
  assert.equal(tickStepper(s, 16, true), true);
  assert.equal(tickStepper(s, 16, true), false);
  assert.equal(FOOTSTEP_INTERVAL_MS, 400);
});

test('terrain: paths are stone, shore is sand, winter ground is snow, the rest grass', () => {
  const world = buildWorld(curriculum);
  const found = new Set();
  const seen = {};
  for (let ty = 0; ty < world.rows; ty++) {
    for (let tx = 0; tx < world.cols; tx++) {
      if (tileAt(world, tx, ty) >= TILE.TREE) continue;
      const t = terrainAt(world, tx, ty);
      found.add(t);
      seen[t] ??= { tx, ty };
    }
  }
  for (const t of ['grass', 'stone', 'snow']) assert.ok(found.has(t), `no ${t} tile in the world`);
  assert.equal(tileAt(world, seen.stone.tx, seen.stone.ty), TILE.PATH);
  const snow = world.regions[world.zones[seen.snow.ty * world.cols + seen.snow.tx]];
  assert.equal(snow.season, 'winter');
  assert.ok(TILE_SIZE > 0);
});

test('evaluation sounds: solid/correct chime, missing/wrong thud, partial silent', () => {
  assert.equal(evaluationSound({ verdict: 'solid' }), 'correct');
  assert.equal(evaluationSound({ verdict: 'missing' }), 'wrong');
  assert.equal(evaluationSound({ verdict: 'partial' }), null);
  assert.equal(evaluationSound({ verdict: 'solid', correct: false }), 'wrong'); // an MCQ's own flag wins
  assert.equal(evaluationSound({ verdict: 'missing', correct: true }), 'correct');
  assert.equal(evaluationSound(undefined), null);
});

test('volume maths and settings defaults', () => {
  assert.equal(sfxGain(1, true), 0);
  assert.equal(sfxGain(0, false), 0);
  assert.ok(sfxGain(0.3, false) < sfxGain(0.9, false));
  assert.equal(clampSfxVolume('x'), DEFAULT_SFX_VOLUME);
  assert.equal(clampSfxVolume(5), 1);
  assert.equal(typeof DEFAULT_SETTINGS.sfxVolume, 'number');
  assert.equal(DEFAULT_SETTINGS.sfxMuted, false);
});

// ---- A fake AudioContext, enough to run every synthesiser.
function fakeContext(state = 'running') {
  const param = (v = 0) => ({
    value: v, calls: [],
    setValueAtTime(x, t) { this.calls.push(['set', x, t]); this.value = x; },
    linearRampToValueAtTime(x, t) { this.calls.push(['ramp', x, t]); },
    exponentialRampToValueAtTime(x, t) { this.calls.push(['exp', x, t]); },
    cancelScheduledValues() {},
  });
  const node = (extra = {}) => ({ connect() {}, disconnect() {}, start() { this.started = true; }, stop() {}, ...extra });
  const ctx = {
    currentTime: 1, sampleRate: 8000, state, destination: node(),
    oscillators: [], sources: [], filters: [], convolvers: [], resumed: 0,
    createGain() { return node({ gain: param(1) }); },
    createOscillator() { const n = node({ frequency: param(440), type: 'sine' }); ctx.oscillators.push(n); return n; },
    createBiquadFilter() { const n = node({ frequency: param(1000), Q: param(1), type: 'lowpass' }); ctx.filters.push(n); return n; },
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len), length: len }; },
    createBufferSource() { const n = node({ playbackRate: param(1), buffer: null }); ctx.sources.push(n); return n; },
    createConvolver() { const n = node({ buffer: null }); ctx.convolvers.push(n); return n; },
    resume() { ctx.resumed++; ctx.state = 'running'; return Promise.resolve(); },
  };
  return ctx;
}
const make = (state) => { const ctx = fakeContext(state); return { ctx, m: new SFXManager({ createContext: () => ctx, gestureTarget: null }) }; };

test('every effect schedules sound with the fake context', () => {
  for (const name of SFX_NAMES) {
    const { ctx, m } = make();
    assert.equal(m.play(name), true, name);
    assert.ok(ctx.oscillators.length + ctx.sources.length > 0, `${name} made no sound`);
  }
});

test('footsteps are filtered white noise; each terrain uses its own filter frequency', () => {
  for (const [terrain, spec] of Object.entries(TERRAIN_SOUND)) {
    const { ctx, m } = make();
    m.play(`footstep-${terrain}`);
    assert.equal(ctx.sources.length, 1);
    assert.equal(ctx.oscillators.length, 0);
    assert.equal(ctx.filters[0].frequency.value, spec.freq);
    assert.equal(ctx.filters[0].type, spec.filter);
  }
});

test('door sweeps a sine 300 to 900 Hz; chime is C5 + E5; thud is 80 Hz sine plus noise', () => {
  let { ctx, m } = make();
  m.play('door-open');
  const o = ctx.oscillators[0];
  assert.equal(o.type, 'sine');
  assert.deepEqual(o.frequency.calls[0].slice(0, 2), ['set', 300]);
  assert.equal(o.frequency.calls[1][1], 900);

  ({ ctx, m } = make());
  m.play('correct');
  assert.deepEqual(ctx.oscillators.map((x) => x.frequency.calls[0][1]), [NOTE_HZ.C5, NOTE_HZ.E5]);
  assert.ok(ctx.oscillators.every((x) => x.type === 'sine'));

  ({ ctx, m } = make());
  m.play('wrong');
  assert.equal(ctx.oscillators[0].frequency.calls[0][1], 80);
  assert.equal(ctx.sources.length, 1);
});

test('fanfare: four triangle notes 100 ms apart through a convolver whose impulse response is built in code', () => {
  const { ctx, m } = make();
  m.play('fanfare');
  assert.equal(ctx.oscillators.length, 4);
  assert.ok(ctx.oscillators.every((o) => o.type === 'triangle'));
  assert.deepEqual(ctx.oscillators.map((o) => o.frequency.calls[0][1]), FANFARE.notes);
  const starts = ctx.oscillators.map((o) => o.frequency.calls[0][2]);
  for (let i = 1; i < 4; i++) assert.ok(Math.abs(starts[i] - starts[i - 1] - 0.1) < 1e-9);
  assert.equal(ctx.convolvers.length, 1);
  assert.ok(ctx.convolvers[0].buffer.length > 0);
  m.play('fanfare'); // the reverb is built once
  assert.equal(ctx.convolvers.length, 1);
});

test('muted, silent, unknown names and a missing AudioContext never throw', () => {
  let { ctx, m } = make();
  m.mute(true);
  assert.equal(m.play('correct'), false);
  assert.equal(ctx.oscillators.length, 0);
  m.mute(false);
  m.setVolume(0);
  assert.equal(m.play('correct'), false);
  m.setVolume(0.5);
  assert.equal(m.play('not-a-sound'), false);
  const none = new SFXManager({ createContext: () => null, gestureTarget: null });
  assert.equal(none.play('fanfare'), false);
  const broken = new SFXManager({ createContext: () => { throw new Error('no audio'); }, gestureTarget: null });
  assert.equal(broken.play('wrong'), false);
});

test('a suspended context is resumed and the early sound is dropped, not queued', () => {
  const { ctx, m } = make('suspended');
  assert.equal(m.play('footstep-grass'), false);
  assert.equal(ctx.resumed, 1);
  assert.equal(ctx.sources.length, 0);
  assert.equal(m.play('footstep-grass'), true); // running now
});
