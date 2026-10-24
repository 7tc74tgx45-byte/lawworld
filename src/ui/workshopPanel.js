// Workshop week-selector panel.
// Opens when the player interacts with a Workshop building.
// Shows: title, vault status, a "Start Workshop" button.
// If Obsidian is offline it shows a warning but still lets the player start
// (the encounter itself handles the fallback gracefully).

import { openOverlay, el, button } from './dom.js';

/**
 * @param {object} opts
 * @param {string} opts.title          - Workshop title, e.g. "Workshop W4: Breach of Duty"
 * @param {string} opts.workshopFile   - Vault filename to load, e.g. "LAW7054-Tort-W4-Workshop-Prep.md"
 * @param {boolean} opts.vaultOnline   - Is Obsidian currently reachable?
 * @param {function} opts.onStart      - Called when the player clicks Start
 */
export function openWorkshopPanel({ title, workshopFile, vaultOnline, onStart }) {
  const { panel, close } = openOverlay({ panelClass: 'small', onEscape: () => close() });

  panel.append(el('h2', 'lw-h', `📋 ${title}`));

  if (!vaultOnline) {
    const warn = el('p', 'lw-hint-note');
    warn.textContent = '⚠️ Obsidian is offline. Connect it in Settings to use Workshop Prep.';
    panel.append(warn);
    panel.append(button('Close', 'primary', close));
    return { close };
  }

  const note = el('p', 'lw-hint-note');
  note.textContent = `Loads: ${workshopFile}`;
  panel.append(note);

  panel.append(el('p', null,
    'Your tutor will walk through each scenario with you — spotting issues, working out the law, applying it to the facts. You talk; they guide. A flash-card round finishes it off.'));

  const startBtn = button('Start Workshop Prep', 'primary', () => {
    close();
    onStart?.();
  });
  panel.append(startBtn);
  panel.append(button('Not now', 'leave', close));

  return { close };
}
