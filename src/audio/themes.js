// The five themes (T15). Each theme is { barSeconds, scheduleBar(ctx, out, t0, bar) }: it schedules one bar of notes
// starting at context time t0. The track player (music.js) calls it again before the bar ends, so loops never gap.

import { voice, padEnv, pluckEnv, swellEnv } from './voices.js';
import {
  midiToHz, CONTRACT_BPM, arpeggioBar, CONTRACT_CHORDS, TORT_DRONE, TORT_BAR_SECONDS, tortMelody,
  WINTER_BAR_SECONDS, winterFifth, HUB_BAR_SECONDS, hubChord, ENCOUNTER_BAR_SECONDS, ENCOUNTER_CHORD, tensionCutoff,
} from '../logic/music.js';

const hz = midiToHz;

function lowpass(ctx, out, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  f.Q.value = q;
  f.connect(out);
  return f;
}

// Contract (summer): bright plucked strings, triangle + sawtooth, 120 BPM eighth-note arpeggio in C major.
const contract = {
  barSeconds: (60 / CONTRACT_BPM) * 4,
  scheduleBar(ctx, out, t0, bar) {
    const eighth = 60 / CONTRACT_BPM / 2;
    const bright = lowpass(ctx, out, 3200);
    for (const { step, midi } of arpeggioBar(bar)) {
      const t = t0 + step * eighth;
      const accent = step === 0 ? 1.25 : 1;
      voice(ctx, out, { type: 'triangle', freq: hz(midi), start: t, end: t + 0.9, peak: 0.16 * accent, env: pluckEnv(0.55) });
      voice(ctx, bright, { type: 'sawtooth', freq: hz(midi), start: t, end: t + 0.6, peak: 0.035 * accent, detune: 5, env: pluckEnv(0.32) });
    }
    const root = CONTRACT_CHORDS[bar % CONTRACT_CHORDS.length][0] - 12;
    for (const beat of [0, 4]) {
      const t = t0 + beat * eighth;
      voice(ctx, out, { type: 'triangle', freq: hz(root), start: t, end: t + 1.4, peak: 0.2, env: pluckEnv(1.0) });
    }
  },
};

// Tort (autumn): A minor drone, a detuned sawtooth pair, slow tremolo, and a few sparse bell notes.
const OVERLAP = 1.5;
const tort = {
  barSeconds: TORT_BAR_SECONDS,
  scheduleBar(ctx, out, t0, bar) {
    const end = t0 + TORT_BAR_SECONDS + OVERLAP;
    const warm = lowpass(ctx, out, 520, 1.2);
    const slow = { rate: 0.13, depth: 0.35 };
    const env = padEnv(OVERLAP, OVERLAP);
    for (const d of [-TORT_DRONE.detuneCents, TORT_DRONE.detuneCents]) {
      voice(ctx, warm, { type: 'sawtooth', freq: hz(TORT_DRONE.low), start: t0, end, peak: 0.07, detune: d, tremolo: slow, env });
      voice(ctx, warm, { type: 'sawtooth', freq: hz(TORT_DRONE.fifth), start: t0, end, peak: 0.03, detune: d, tremolo: { rate: 0.09, depth: 0.4 }, env });
    }
    voice(ctx, out, { type: 'sine', freq: hz(TORT_DRONE.low - 12), start: t0, end, peak: 0.12, env });
    for (const n of tortMelody(bar)) {
      const t = t0 + n.at;
      voice(ctx, out, { type: 'sine', freq: hz(n.midi), start: t, end: t + 3, peak: 0.07, env: pluckEnv(2.6) });
      voice(ctx, out, { type: 'triangle', freq: hz(n.midi + 12), start: t, end: t + 2, peak: 0.015, env: pluckEnv(1.6) });
    }
  },
};

// Public Law (winter): sparse open fifths, sine waves, long attack, slow decay.
const publicLaw = {
  barSeconds: WINTER_BAR_SECONDS,
  scheduleBar(ctx, out, t0, bar) {
    const [root, fifth] = winterFifth(bar);
    voice(ctx, out, { type: 'sine', freq: hz(root), start: t0, end: t0 + WINTER_BAR_SECONDS + 3, peak: 0.12, env: swellEnv(2.6) });
    voice(ctx, out, { type: 'sine', freq: hz(fifth), start: t0 + 0.8, end: t0 + WINTER_BAR_SECONDS + 3, peak: 0.09, env: swellEnv(2.8) });
    voice(ctx, out, { type: 'sine', freq: hz(fifth + 12), start: t0 + 3.6, end: t0 + WINTER_BAR_SECONDS + 2, peak: 0.035, detune: 3, env: swellEnv(2) });
  },
};

// Hub (spring): a warm pad, sine + triangle, with gentle vibrato.
const hub = {
  barSeconds: HUB_BAR_SECONDS,
  scheduleBar(ctx, out, t0, bar) {
    const end = t0 + HUB_BAR_SECONDS + 2;
    const env = padEnv(2, 2);
    const soft = lowpass(ctx, out, 1800);
    hubChord(bar).forEach((m, i) => {
      const vibrato = { rate: 4.6 + i * 0.3, cents: 5 };
      voice(ctx, out, { type: 'sine', freq: hz(m), start: t0, end, peak: 0.07, vibrato, env });
      voice(ctx, soft, { type: 'triangle', freq: hz(m), start: t0, end, peak: 0.04, detune: 4, vibrato, env });
    });
  },
};

// Encounter: low diminished-seventh drone; a resonant filter sweeps up slowly, so the room feels like it is closing in.
const encounter = {
  barSeconds: ENCOUNTER_BAR_SECONDS,
  scheduleBar(ctx, out, t0, bar) {
    const end = t0 + ENCOUNTER_BAR_SECONDS + OVERLAP;
    const { from, to } = tensionCutoff(bar);
    const f = lowpass(ctx, out, from, 3);
    f.frequency.setValueAtTime(from, t0);
    f.frequency.linearRampToValueAtTime(to, t0 + ENCOUNTER_BAR_SECONDS);
    const env = padEnv(OVERLAP, OVERLAP);
    ENCOUNTER_CHORD.forEach((m, i) => {
      voice(ctx, f, { type: 'sawtooth', freq: hz(m), start: t0, end, peak: 0.075, detune: i % 2 ? 7 : -7, env });
    });
    voice(ctx, out, { type: 'sine', freq: hz(ENCOUNTER_CHORD[0] - 12), start: t0, end, peak: 0.16, env });
  },
};

export const THEMES = { hub, contract, tort, publicLaw, encounter };
