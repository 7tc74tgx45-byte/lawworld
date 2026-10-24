// Tiny localStorage-backed settings store. Safe to import anywhere in the browser;
// every access is wrapped so private mode / missing storage never throws.

const KEY = 'lawworld.settings.v1';

export const DEFAULT_SETTINGS = {
  claudeApiKey: '',
  claudeModel: 'claude-sonnet-5-5',
  obsidianUrl: 'https://127.0.0.1:27124',
  obsidianToken: '',
  musicVolume: 0.5, // 0-1 (T15)
  musicMuted: false,
  sfxVolume: 0.7, // 0-1 (T18)
  sfxMuted: false,
};

function storage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function getAllSettings() {
  const s = storage();
  if (!s) return { ...DEFAULT_SETTINGS };
  try {
    const raw = s.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_SETTINGS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** The value the player actually saved, or undefined (ignores defaults). Used for "settings first, .env second". */
export function getStoredSetting(name) {
  const s = storage();
  if (!s) return undefined;
  try {
    const raw = s.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const v = parsed && typeof parsed === 'object' ? parsed[name] : undefined;
    return typeof v === 'string' && v.trim() === '' ? undefined : v;
  } catch {
    return undefined;
  }
}

export function getSetting(name) {
  return getAllSettings()[name];
}

export function setSetting(name, value) {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(KEY, JSON.stringify({ ...getAllSettings(), [name]: value }));
    return true;
  } catch {
    return false;
  }
}
