// Pure sound-effect rules (T18): names, terrain -> footstep colour, step timing, which answers chime or thud.
// No Web Audio here, so all of it is unit-tested. The sound itself is synthesised in src/audio/sfx.js.

import { TILE, tileAt, zoneAt } from './worldQuery.js';

export const SFX_NAMES = [
  'footstep-grass', 'footstep-stone', 'footstep-sand', 'footstep-snow',
  'door-open', 'correct', 'wrong', 'fanfare',
];
export const isSfxName = (n) => SFX_NAMES.includes(n);

export const DEFAULT_SFX_VOLUME = 0.7;
export const clampSfxVolume = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_SFX_VOLUME;
  return Math.min(1, Math.max(0, n));
};
/** Master gain for a slider value (squared curve, like the music). */
export const sfxGain = (volume, muted) => (muted ? 0 : Math.pow(clampSfxVolume(volume), 2) * 0.9);

// ---- Footsteps: a white-noise burst, 80 ms, exponential decay, shaped by a filter that depends on the ground.
export const FOOTSTEP_MS = 80;
export const FOOTSTEP_INTERVAL_MS = 400;
// peak compensates for how little noise energy gets through a low filter, so every terrain sits at a similar loudness.
export const TERRAIN_SOUND = {
  grass: { filter: 'lowpass', freq: 200, q: 0.7, peak: 1.1 }, // low, dull
  stone: { filter: 'bandpass', freq: 800, q: 1.2, peak: 0.55 }, // mid, clicky
  sand: { filter: 'lowpass', freq: 100, q: 0.5, peak: 1.3 }, // soft
  snow: { filter: 'bandpass', freq: 1200, q: 2.5, peak: 0.45 }, // crisp
};

/** Name of the footstep sound for a terrain ('grass' | 'stone' | 'sand' | 'snow'). */
export const footstepName = (terrain) => `footstep-${terrain in TERRAIN_SOUND ? terrain : 'grass'}`;

/** What the player is walking on at a tile: paths are stone, shore is sand, winter ground is snow, the rest grass. */
export function terrainAt(world, tx, ty) {
  if (tileAt(world, tx, ty) === TILE.PATH) return 'stone';
  const nearWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(world, tx + dx, ty + dy) === TILE.WATER);
  if (nearWater) return 'sand';
  const season = world.regions?.[zoneAt(world, tx, ty)]?.season;
  return season === 'winter' ? 'snow' : 'grass';
}

/**
 * Step timer: one footstep per FOOTSTEP_INTERVAL_MS of walking. The first step lands as soon as the player starts
 * walking (if the last one was long enough ago), so tapping a key cannot machine-gun steps.
 */
export function createStepper() {
  return { sinceLast: FOOTSTEP_INTERVAL_MS };
}
export function tickStepper(stepper, dtMs, walking, interval = FOOTSTEP_INTERVAL_MS) {
  stepper.sinceLast += Math.max(0, dtMs);
  if (!walking || stepper.sinceLast < interval) return false;
  stepper.sinceLast = 0;
  return true;
}

// ---- Tones
export const NOTE_HZ = { C4: 261.63, E4: 329.63, G4: 392.0, C5: 523.25, E5: 659.25 };
export const DOOR_SWEEP = { from: 300, to: 900, seconds: 0.2 };
export const CHIME = { notes: [NOTE_HZ.C5, NOTE_HZ.E5], seconds: 0.4 }; // a major third
export const THUD = { hz: 80, seconds: 0.15, noiseSeconds: 0.05 };
export const FANFARE = {
  notes: [NOTE_HZ.C4, NOTE_HZ.E4, NOTE_HZ.G4, NOTE_HZ.C5],
  noteSeconds: 0.1, // each note starts 100 ms after the last
  tailSeconds: 0.5, // the last note rings on into the reverb
  reverbSeconds: 1.6,
};

/**
 * Which sound an evaluation earns, or null for none. An MCQ is right or wrong; an open answer chimes when solid,
 * thuds when missing, and stays quiet when partial (a follow-up is coming, and a thud would feel like a punishment).
 */
export function evaluationSound(ev) {
  if (!ev || typeof ev !== 'object') return null;
  if (typeof ev.correct === 'boolean') return ev.correct ? 'correct' : 'wrong';
  if (ev.verdict === 'solid') return 'correct';
  if (ev.verdict === 'missing') return 'wrong';
  return null;
}
