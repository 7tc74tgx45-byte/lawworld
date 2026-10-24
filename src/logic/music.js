// Pure music rules (T15): which theme plays where, the notes each theme uses, volume maths.
// No Web Audio here, so all of it is unit-tested. The sound itself is made in src/audio/.

export const CROSSFADE_SECONDS = 2;
export const DEFAULT_MUSIC_VOLUME = 0.5;
export const THEME_NAMES = ['hub', 'contract', 'tort', 'publicLaw', 'encounter'];

// Region ids (from the curriculum) and seasons both map to a theme; anything unknown gets the hub pad.
const REGION_THEME = {
  foundations: 'hub', hub: 'hub', spring: 'hub',
  contract: 'contract', summer: 'contract',
  tort: 'tort', autumn: 'tort',
  'public-law': 'publicLaw', publicLaw: 'publicLaw', winter: 'publicLaw',
};

export const themeForRegion = (regionIdOrSeason) => REGION_THEME[regionIdOrSeason] ?? 'hub';

export const midiToHz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export const clampVolume = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_MUSIC_VOLUME;
  return Math.min(1, Math.max(0, n));
};

/** Master gain for a slider value: a squared curve (volume feels linear to the ear) and a ceiling so music stays under the UI. */
export const effectiveGain = (volume, muted) => (muted ? 0 : Math.pow(clampVolume(volume), 2) * 0.6);

// ---- Contract (summer): 120 BPM, C major, a plucked arpeggio over C - Am - F - G, one chord per bar.
export const CONTRACT_BPM = 120;
export const CONTRACT_CHORDS = [
  [60, 64, 67, 72], // C
  [57, 60, 64, 69], // Am
  [53, 57, 60, 65], // F
  [55, 59, 62, 67], // G
];
const ARP_ORDER = [0, 1, 2, 3, 2, 1, 2, 3];

/** The eight eighth-notes of a bar: [{ step (0-7), midi }]. Pitched an octave up so the pluck sounds bright. */
export function arpeggioBar(barIndex) {
  const chord = CONTRACT_CHORDS[barIndex % CONTRACT_CHORDS.length];
  return ARP_ORDER.map((idx, step) => ({ step, midi: chord[idx] + 12 }));
}

// ---- Tort (autumn): A minor drone with a few sparse bell notes from the A minor pentatonic.
export const TORT_DRONE = { low: 45, fifth: 52, detuneCents: 9 }; // A2, E3
export const TORT_BAR_SECONDS = 8;
const TORT_MELODY = [
  [{ at: 1, midi: 69 }, { at: 4.5, midi: 64 }],
  [{ at: 2, midi: 67 }, { at: 6, midi: 60 }],
  [{ at: 0.5, midi: 64 }, { at: 3.5, midi: 69 }, { at: 6.5, midi: 72 }],
  [{ at: 3, midi: 60 }],
];
export const tortMelody = (barIndex) => TORT_MELODY[barIndex % TORT_MELODY.length];

// ---- Public Law (winter): sparse open fifths (root + fifth, no third), long attack, slow decay.
export const WINTER_BAR_SECONDS = 8;
const WINTER_FIFTHS = [[50, 57], [45, 52], [48, 55], [43, 50]]; // D-A, A-E, C-G, G-D
export const winterFifth = (barIndex) => WINTER_FIFTHS[barIndex % WINTER_FIFTHS.length];

// ---- Hub (spring): a warm pad, sine + triangle, with gentle vibrato.
export const HUB_BAR_SECONDS = 8;
const HUB_CHORDS = [
  [48, 55, 64, 67], // C (add 9 spread)
  [45, 52, 60, 67], // Am7
  [41, 48, 57, 64], // Fmaj7
  [43, 50, 59, 62], // G
];
export const hubChord = (barIndex) => HUB_CHORDS[barIndex % HUB_CHORDS.length];

// ---- Encounter: a low diminished-seventh drone (C, Eb, Gb, A) whose filter opens slowly, then eases back.
export const ENCOUNTER_BAR_SECONDS = 8;
export const ENCOUNTER_CHORD = [36, 39, 42, 45];
const RISE_BARS = 6;
const FALL_BARS = 2;
export const CUTOFF_LOW = 180;
export const CUTOFF_HIGH = 1500;

/** Filter cutoff sweep for one bar: { from, to } in Hz. Rises over six bars, then settles back over two, then repeats. */
export function tensionCutoff(barIndex) {
  const k = barIndex % (RISE_BARS + FALL_BARS);
  const at = (n) => CUTOFF_LOW * Math.pow(CUTOFF_HIGH / CUTOFF_LOW, n / RISE_BARS);
  if (k < RISE_BARS) return { from: at(k), to: at(k + 1) };
  const j = k - RISE_BARS;
  const down = (n) => CUTOFF_HIGH * Math.pow(CUTOFF_LOW / CUTOFF_HIGH, n / FALL_BARS);
  return { from: down(j), to: down(j + 1) };
}
