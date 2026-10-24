// Thin browser adapter for the save system: real localStorage, page-hide flushing,
// export (download link) and import (file input). All rules live in src/logic/save*.js.

import { createSaveStore } from '../logic/saveStore.js';
import { exportFilename } from '../logic/save.js';

function browserStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

let store = null;

/** One shared store for the page. Flushes a pending autosave when the tab is hidden or closed. */
export function getSaveStore() {
  if (store) return store;
  store = createSaveStore({ storage: browserStorage() });
  const flush = () => store.flush();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  return store;
}

/** Download the current save as a JSON file via a temporary <a download> link. */
export function downloadSave(saveStore = getSaveStore()) {
  const blob = new Blob([saveStore.exportText()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFilename();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Open a file picker and import the chosen JSON save.
 * Resolves { ok:true } or { ok:false, message }; never rejects. Resolves { ok:false, cancelled:true } if no file was chosen.
 */
export function pickAndImportSave(saveStore = getSaveStore()) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve({ ok: false, cancelled: true, message: 'No file chosen.' });
      try {
        resolve(saveStore.importText(await file.text()));
      } catch {
        resolve({ ok: false, message: 'That file could not be read, so nothing was changed.' });
      }
    });
    input.addEventListener('cancel', () => {
      input.remove();
      resolve({ ok: false, cancelled: true, message: 'No file chosen.' });
    });
    document.body.append(input);
    input.click();
  });
}
