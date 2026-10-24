// Tiny DOM helpers shared by the overlays, plus the shared overlay lock.
// While ANY overlay is open the game scene disables Phaser keyboard input and releases key captures,
// so W/A/S/D/Space/E can be typed. The lock is counted, so stacked overlays (menu -> settings) are safe.

import { createOverlayLock } from '../logic/overlayLock.js';

export const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export const button = (label, cls, onclick) => {
  const b = el('button', 'lw-btn' + (cls ? ' ' + cls : ''), label);
  b.type = 'button';
  if (onclick) b.onclick = onclick;
  return b;
};

let handlers = { lock() {}, unlock() {} };
const lock = createOverlayLock({ lock: () => handlers.lock(), unlock: () => handlers.unlock() });

/** The scene registers how to disable / re-enable its keyboard. */
export function setOverlayHandlers(h) {
  handlers = { lock() {}, unlock() {}, ...h };
}
export const isAnyOverlayOpen = () => lock.isOpen;

/**
 * Create a full-screen overlay with a panel inside. Keys typed inside never reach the game.
 * Returns { overlay, panel, close }. `onEscape` (optional) runs when Esc is pressed inside.
 */
export function openOverlay({ panelClass = '', onEscape, onClosed } = {}) {
  const release = lock.acquire();
  const overlay = el('div', 'lw-overlay');
  const panel = el('div', 'lw-panel ' + panelClass);
  overlay.append(panel);
  document.body.append(overlay);
  let closed = false;
  const onKey = (e) => {
    e.stopPropagation(); // typed keys must not reach any game listener
    if (e.key === 'Escape') {
      e.preventDefault();
      onEscape?.();
    }
  };
  overlay.addEventListener('keydown', onKey);
  overlay.addEventListener('keyup', (e) => e.stopPropagation());
  // Keep focus inside the overlay so key events go to it.
  overlay.tabIndex = -1;
  overlay.focus();
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.remove();
    release();
    onClosed?.();
  };
  return { overlay, panel, close };
}
