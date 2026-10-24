// Save system (T04). Pure JS: no Phaser, no DOM, no direct localStorage.
// Storage is injected: anything with getItem / setItem / removeItem (localStorage, or a Map-backed fake in tests).
//
// Schema (version 1) covers VISION §7:
//   {
//     version: 1, savedAt: ISO string,
//     player:   { x, y, region, facing },
//     cat:      { x, y },
//     progress: { subsections, gaps, stats }        // exactly the object src/logic/progress.js works on
//     inventory:{ seeds, materials:{ precedentScrolls, caseReports, statuteRolls, ink } },
//     garden:   { plots:[{ id, seedId, subsectionId, concept, stage, plantedAt, lastWatered }] },
//     braziers: { lit: [districtId] },
//     tutorPreference: { [subsectionId]: tutorId },
//     settings: { ...non-secret gameplay preferences },
//     sessions: [{ subsectionId, title, module, date, tutor, outcome, finished, exchanges, gaps, gapConcepts }]  // capped log for the journal (T11)
//   }
// `sessions` was added without a version bump: it is optional and normalised to [] for older saves.
// Secrets (Claude key, Obsidian token) are NOT part of a save: they live in src/settings.js, and a
// save file is something Fynn may export, share or paste somewhere. Anything key-like is stripped.
//
// Safety rules:
//  - load() never throws. Unreadable / corrupt / too-new saves yield a fresh game, and the bad raw
//    text is copied to a backup key first so autosave can't silently destroy it.
//  - import is stricter than load: it reports *why* a file was rejected, and changes nothing.

import { createProgress, normaliseProgress } from './progress.js';
import { normaliseSessions } from './sessionLog.js';
import { normaliseClients } from './clients.js';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'lawworld.save';
export const BACKUP_KEY = 'lawworld.save.backup';
export const DEFAULT_AUTOSAVE_MS = 800;

export const MATERIAL_KEYS = ['precedentScrolls', 'caseReports', 'statuteRolls', 'ink'];
export const DEFAULT_PLAYER = { x: 480, y: 320, region: 'hub', facing: 'down' };
export const DEFAULT_CAT = { x: 456, y: 344 };
const FACINGS = ['up', 'down', 'left', 'right'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v, fallback) => (typeof v === 'string' && v ? v : fallback);
const count = (v) => Math.max(0, Math.floor(num(v, 0)));
const SECRET_NAME = /key|token|secret|password|authorization/i;

// ---------------------------------------------------------------------------
// Fresh game and normalisation
// ---------------------------------------------------------------------------

export function createFreshSave(now) {
  return normaliseSave({}, now);
}

function normalisePlot(p, i) {
  if (!isObj(p)) return null;
  return {
    id: str(p.id, `plot-${i}`),
    seedId: str(p.seedId, null),
    subsectionId: str(p.subsectionId, null),
    concept: str(p.concept, null),
    stage: Math.min(5, count(p.stage)),
    plantedAt: str(p.plantedAt, null),
    lastWatered: str(p.lastWatered, null),
  };
}

/** Drop malformed entries so one bad record can't break gating or the gap list. */
function cleanProgress(p) {
  const subsections = {};
  for (const [id, v] of Object.entries(p.subsections)) {
    if (isObj(v) && (v.status === 'explored' || v.status === 'consolidated')) subsections[id] = v;
  }
  const gaps = p.gaps.filter((g) => isObj(g) && typeof g.subsectionId === 'string' && typeof g.concept === 'string' && g.concept.trim());
  const stats = Object.fromEntries(Object.entries(p.stats).map(([k, v]) => [k, Math.max(0, num(v, 0))]));
  return { ...p, subsections, gaps, stats };
}

function normaliseSettings(s) {
  const out = {};
  if (!isObj(s)) return out;
  for (const [k, v] of Object.entries(s)) {
    if (SECRET_NAME.test(k)) continue;
    if (['string', 'number', 'boolean'].includes(typeof v)) out[k] = v;
  }
  return out;
}

/**
 * Coerce anything into a valid current-version save, keeping whatever is usable.
 * Never throws. Does not run migrations (see migrate()).
 */
export function normaliseSave(raw, now) {
  const s = isObj(raw) ? raw : {};
  const player = isObj(s.player) ? s.player : {};
  const cat = isObj(s.cat) ? s.cat : {};
  const inv = isObj(s.inventory) ? s.inventory : {};
  const mats = isObj(inv.materials) ? inv.materials : {};
  const garden = isObj(s.garden) ? s.garden : {};
  const braziers = isObj(s.braziers) ? s.braziers : {};
  const tp = isObj(s.tutorPreference) ? s.tutorPreference : {};

  const savedAt = (() => {
    if (typeof s.savedAt === 'string' && !Number.isNaN(Date.parse(s.savedAt))) return s.savedAt;
    return (now === undefined ? new Date() : new Date(now)).toISOString();
  })();

  return {
    version: SAVE_VERSION,
    savedAt,
    player: {
      x: num(player.x, DEFAULT_PLAYER.x),
      y: num(player.y, DEFAULT_PLAYER.y),
      region: str(player.region, DEFAULT_PLAYER.region),
      facing: FACINGS.includes(player.facing) ? player.facing : DEFAULT_PLAYER.facing,
    },
    cat: { x: num(cat.x, DEFAULT_CAT.x), y: num(cat.y, DEFAULT_CAT.y) },
    progress: cleanProgress(normaliseProgress(s.progress ?? createProgress())),
    inventory: {
      seeds: count(inv.seeds),
      materials: Object.fromEntries(MATERIAL_KEYS.map((k) => [k, count(mats[k])])),
    },
    garden: { plots: (Array.isArray(garden.plots) ? garden.plots : []).map(normalisePlot).filter(Boolean) },
    braziers: { lit: [...new Set((Array.isArray(braziers.lit) ? braziers.lit : []).filter((x) => typeof x === 'string' && x))] },
    tutorPreference: Object.fromEntries(Object.entries(tp).filter(([k, v]) => k && typeof v === 'string' && v)),
    settings: normaliseSettings(s.settings),
    sessions: normaliseSessions(s.sessions),
    clients: normaliseClients(s.clients),
  };
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/**
 * MIGRATIONS[n] upgrades a version-n save object to version n+1 (returns a new object).
 * Add MIGRATIONS[1] when the schema moves to v2; never edit an old step.
 * 0 -> 1: pre-versioned prototype saves kept progress at the top level.
 */
export const MIGRATIONS = {
  0: (s) => {
    const { subsections, gaps, stats, ...rest } = s;
    return { ...rest, progress: s.progress ?? { subsections, gaps, stats } };
  },
};

/** Version of a raw save object; an object with no version is treated as 0. */
export function saveVersionOf(raw) {
  if (!isObj(raw)) return null;
  if (raw.version === undefined) return 0;
  return Number.isInteger(raw.version) && raw.version >= 0 ? raw.version : null;
}

/**
 * Bring a raw save object up to the current version, then normalise it.
 * @returns {{ok:true, save:object, from:number, steps:number} | {ok:false, reason:string}}
 * Options let tests inject a future version / migration table.
 */
export function migrate(raw, { migrations = MIGRATIONS, target = SAVE_VERSION, now } = {}) {
  const from = saveVersionOf(raw);
  if (from === null) return { ok: false, reason: 'not-a-save' };
  if (from > target) return { ok: false, reason: 'newer-version' };
  let cur = raw;
  let steps = 0;
  try {
    for (let v = from; v < target; v++) {
      const step = migrations[v];
      if (typeof step !== 'function') return { ok: false, reason: `missing-migration-${v}` };
      cur = { ...step(cur), version: v + 1 };
      steps++;
    }
  } catch {
    return { ok: false, reason: 'migration-failed' };
  }
  return { ok: true, save: normaliseSave({ ...cur, version: target }, now), from, steps };
}

// ---------------------------------------------------------------------------
// Load / save with injected storage
// ---------------------------------------------------------------------------

/** Parse text into a migrated save, or a reason it can't be used. Never throws. */
export function parseSave(text, opts) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }
  return migrate(raw, opts);
}

export function serializeSave(save, now) {
  return JSON.stringify(normaliseSave({ ...save, savedAt: (now === undefined ? new Date() : new Date(now)).toISOString() }, now));
}

/**
 * Load the saved game. Never throws.
 * @returns {{save:object, status:'loaded'|'fresh'|'recovered', reason?:string, migratedFrom?:number}}
 *  - fresh:     nothing stored (or storage unavailable)
 *  - recovered: something was stored but unusable; a fresh game is returned and the raw text is kept under BACKUP_KEY
 */
export function loadSave(storage, opts = {}) {
  let text = null;
  try {
    text = storage?.getItem(SAVE_KEY) ?? null;
  } catch {
    return { save: createFreshSave(opts.now), status: 'fresh', reason: 'storage-unavailable' };
  }
  if (text === null) return { save: createFreshSave(opts.now), status: 'fresh' };

  const parsed = parseSave(text, opts);
  if (parsed.ok) return { save: parsed.save, status: 'loaded', migratedFrom: parsed.from };

  try {
    storage.setItem(BACKUP_KEY, text);
  } catch {
    /* backup is best effort */
  }
  return { save: createFreshSave(opts.now), status: 'recovered', reason: parsed.reason };
}

/** Write the save. Never throws; returns { ok, error? } (e.g. quota exceeded). */
export function writeSave(storage, save, now) {
  try {
    if (!storage) return { ok: false, error: 'storage-unavailable' };
    storage.setItem(SAVE_KEY, serializeSave(save, now));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export function clearSave(storage) {
  try {
    storage?.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Debounced autosave
// ---------------------------------------------------------------------------

/**
 * Coalesces bursts of "something changed" into one write.
 * @param {{ storage, getState: () => object, delayMs?: number, timers?: {setTimeout, clearTimeout}, now?: () => number, onSaved?: (r)=>void }} o
 * schedule(): call after any meaningful action. flush(): write now if dirty (call on pagehide/close).
 */
export function createAutosaver({ storage, getState, delayMs = DEFAULT_AUTOSAVE_MS, timers, now, onSaved }) {
  const t = timers ?? { setTimeout: (...a) => setTimeout(...a), clearTimeout: (...a) => clearTimeout(...a) };
  let handle = null;
  let dirty = false;
  let last = null;

  function run() {
    handle = null;
    dirty = false;
    last = writeSave(storage, getState(), now?.());
    onSaved?.(last);
    return last;
  }

  return {
    schedule() {
      dirty = true;
      if (handle !== null) t.clearTimeout(handle);
      handle = t.setTimeout(run, delayMs);
    },
    flush() {
      if (handle !== null) {
        t.clearTimeout(handle);
        handle = null;
      }
      return dirty ? run() : last;
    },
    cancel() {
      if (handle !== null) t.clearTimeout(handle);
      handle = null;
      dirty = false;
    },
    get pending() {
      return dirty;
    },
    get lastResult() {
      return last;
    },
  };
}

// ---------------------------------------------------------------------------
// Export / import (pure parts; the file input and download link live in src/ui/saveAdapter.js)
// ---------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');

export function exportFilename(now) {
  const d = now === undefined ? new Date() : new Date(now);
  return `lawworld-save-${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}.json`;
}

/** Pretty JSON text of the save, ready to download. */
export function exportSave(save, now) {
  const normalised = normaliseSave({ ...save, savedAt: (now === undefined ? new Date() : new Date(now)).toISOString() }, now);
  return JSON.stringify(normalised, null, 2);
}

const IMPORT_MESSAGES = {
  'invalid-json': 'That file is not valid JSON, so nothing was changed.',
  'not-a-save': 'That file does not look like a LawWorld save, so nothing was changed.',
  'newer-version': 'That save was made by a newer version of LawWorld, so nothing was changed.',
  'migration-failed': 'That save could not be upgraded, so nothing was changed.',
};

/** Validate an imported file's text. Never throws; does not touch storage. */
export function importSave(text, opts) {
  // Stricter than load: an unversioned object must at least look like a save, so importing
  // a random JSON file can't silently wipe the game with a blank one.
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid-json', message: IMPORT_MESSAGES['invalid-json'] };
  }
  const looksLikeSave = isObj(raw) && (raw.version !== undefined || isObj(raw.progress) || isObj(raw.player) || isObj(raw.subsections));
  if (!looksLikeSave) return { ok: false, reason: 'not-a-save', message: IMPORT_MESSAGES['not-a-save'] };
  const parsed = migrate(raw, opts);
  if (parsed.ok) return parsed;
  return { ok: false, reason: parsed.reason, message: IMPORT_MESSAGES[parsed.reason] ?? 'That save could not be read, so nothing was changed.' };
}
