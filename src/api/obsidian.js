// Obsidian Local REST API client (browser).
// Plugin: https://github.com/coddingtonbear/obsidian-local-rest-api
// Default base URL: https://127.0.0.1:27124 (self-signed certificate: open that URL once and accept it).
// URL and token come from in-game Settings first; .env is a dev-only fallback.
//
// Writes are guarded by src/logic/noteGuard.js: only TUTOR-SESSION-*.md, never a study note.

import { getSetting, getStoredSetting } from '../settings.js';
import { assertWritable, encodeVaultPath, normaliseBaseUrl } from '../logic/noteGuard.js';

export const DEFAULT_OBSIDIAN_URL = 'https://127.0.0.1:27124';

export function getObsidianConfig() {
  const dev = import.meta.env?.DEV;
  const url = getStoredSetting('obsidianUrl') || (dev && import.meta.env.VITE_OBSIDIAN_BASE_URL) || getSetting('obsidianUrl');
  const token = getStoredSetting('obsidianToken') || (dev && import.meta.env.VITE_OBSIDIAN_TOKEN) || '';
  return { baseUrl: normaliseBaseUrl(url, DEFAULT_OBSIDIAN_URL), token: String(token).trim() };
}

function authHeaders(extra = {}) {
  const { token } = getObsidianConfig();
  if (!token) throw new Error('No Obsidian token. Add one in Settings (or VITE_OBSIDIAN_TOKEN in .env for local dev).');
  return { Authorization: `Bearer ${token}`, ...extra };
}

function vaultUrl(path) {
  return `${getObsidianConfig().baseUrl}/vault/${encodeVaultPath(path)}`;
}

/**
 * Read a note from the vault.
 * @param {string} path - Vault-relative path, e.g. 'LAW7054-Contract-W2-Consideration.md'
 * @returns {Promise<string>} Raw markdown.
 */
export async function readNote(path) {
  const res = await fetch(vaultUrl(path), { headers: authHeaders({ Accept: 'text/markdown' }) });
  if (!res.ok) throw new Error(`Obsidian read error ${res.status}: ${path}`);
  return res.text();
}

/**
 * List the files in the vault root (the vault is flat). Returns filenames.
 * @returns {Promise<string[]>}
 */
export async function listFiles() {
  const res = await fetch(`${getObsidianConfig().baseUrl}/vault/`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Obsidian list error ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.files) ? data.files : [];
}

/**
 * Write (create or overwrite) a session note. REFUSES anything that is not
 * TUTOR-SESSION-*.md, and always refuses LAW7054-Tort-Ch8-Breach-Standard-of-Care.md.
 * The guard runs before any config or network access.
 */
export async function writeNote(filename, content) {
  assertWritable(filename);
  const res = await fetch(vaultUrl(filename), {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'text/markdown' }),
    body: content,
  });
  if (!res.ok) throw new Error(`Obsidian write error ${res.status}: ${filename}`);
}

/**
 * Search notes using Obsidian's simple search API.
 * @returns {Promise<Array>}
 */
export async function searchNotes(query) {
  const res = await fetch(`${getObsidianConfig().baseUrl}/search/simple/?query=${encodeURIComponent(query)}`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Obsidian search error ${res.status}`);
  return res.json();
}

/** Quick connectivity check for the Settings screen. Returns { ok, message }. */
export async function testConnection() {
  const { baseUrl, token } = getObsidianConfig();
  try {
    if (!token) return { ok: false, message: 'No Obsidian token set. Copy it from the Local REST API plugin settings in Obsidian.' };
    const res = await fetch(`${baseUrl}/`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) return { ok: false, message: 'Obsidian rejected the token.' };
    if (!res.ok) return { ok: false, message: `Obsidian replied ${res.status}.` };
    return { ok: true, message: `Connected to Obsidian at ${baseUrl}.` };
  } catch {
    return {
      ok: false,
      message: `Could not reach Obsidian at ${baseUrl}. Is Obsidian open with the Local REST API plugin switched on? Open ${baseUrl} in a new browser tab once and accept the certificate warning, then test again.`,
    };
  }
}
