// In-memory holder for the current save, wired to debounced autosave. Pure JS (storage and timers injected).
//
//   const store = createSaveStore({ storage });
//   store.state                      // the current save object (treat as read-only)
//   store.update(s => ({...s, ...})) // replace via a pure function, then autosave is scheduled
//   store.applyEncounter(result, { subsection })  // progress.applyEncounterResult + save
//   store.importText(text)           // validated import; on failure nothing changes
//   store.exportText() / store.flush() / store.reset()

import { loadSave, createAutosaver, createFreshSave, writeSave, importSave, exportSave, clearSave, normaliseSave } from './save.js';
import { applyEncounterResult } from './progress.js';
import { recordSession } from './sessionLog.js';
import { seedsAllowed } from './garden.js';

export function createSaveStore({ storage, timers, now, delayMs, onChange, onSaved } = {}) {
  const loaded = loadSave(storage, { now: now?.() });
  let state = loaded.save;
  const autosaver = createAutosaver({ storage, getState: () => state, timers, now, delayMs, onSaved });

  const commit = (next, { immediate = false } = {}) => {
    state = normaliseSave(next, now?.());
    onChange?.(state);
    if (immediate) {
      autosaver.cancel();
      return writeSave(storage, state, now?.());
    }
    autosaver.schedule();
    return { ok: true, pending: true };
  };

  return {
    get state() {
      return state;
    },
    /** 'loaded' | 'fresh' | 'recovered' (a corrupt save was replaced; the raw text is under BACKUP_KEY). */
    loadStatus: loaded.status,
    loadReason: loaded.reason,
    update(fn) {
      return commit(fn(state));
    },
    applyEncounter(result, { subsection } = {}) {
      const progress = applyEncounterResult(state.progress, result, { subsection, now: now?.() });
      if (progress === state.progress) return false; // nothing answered: nothing changes
      // T13: a seed per solid answered stage, capped per subsection per day so a replayed building cannot farm seeds.
      const paid = seedsAllowed(result, state.sessions, now?.());
      const seeds = (state.inventory?.seeds ?? 0) + paid;
      const outcome = progress.subsections[result.subsectionId]?.lastOutcome ?? 'explored';
      const sessions = recordSession(state.sessions ?? [], result, { subsection, outcome, now: now?.(), seeds: paid });
      commit({ ...state, inventory: { ...state.inventory, seeds }, progress, sessions }, { immediate: true }); // a finished encounter is worth saving right away
      return true;
    },
    importText(text) {
      const r = importSave(text, { now: now?.() });
      if (!r.ok) return r;
      commit(r.save, { immediate: true });
      return { ok: true, migratedFrom: r.from };
    },
    exportText: () => exportSave(state, now?.()),
    save: () => commit(state, { immediate: true }), // manual "Save" in the menu
    flush: () => autosaver.flush(),
    get pending() {
      return autosaver.pending;
    },
    reset() {
      autosaver.cancel();
      clearSave(storage);
      state = createFreshSave(now?.());
      onChange?.(state);
    },
  };
}
