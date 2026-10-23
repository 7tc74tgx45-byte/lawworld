// Obsidian Local REST API client
// Requires the "Local REST API" community plugin: https://github.com/coddingtonbear/obsidian-local-rest-api
// Default base URL: http://127.0.0.1:27123

const BASE_URL = import.meta.env.VITE_OBSIDIAN_BASE_URL || 'http://127.0.0.1:27123';

function headers() {
  const token = import.meta.env.VITE_OBSIDIAN_TOKEN;
  if (!token) throw new Error('VITE_OBSIDIAN_TOKEN is not set in .env');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Read a note from the Obsidian vault.
 * @param {string} path - Vault-relative path, e.g. 'Law/Contract.md'
 * @returns {Promise<string>} - Raw markdown content.
 */
export async function readNote(path) {
  const res = await fetch(`${BASE_URL}/vault/${encodeURIComponent(path)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Obsidian read error ${res.status}: ${path}`);
  return res.text();
}

/**
 * Write (create or overwrite) a note in the Obsidian vault.
 * @param {string} path - Vault-relative path.
 * @param {string} content - Markdown content to write.
 */
export async function writeNote(path, content) {
  const res = await fetch(`${BASE_URL}/vault/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: headers(),
    body: content,
  });
  if (!res.ok) throw new Error(`Obsidian write error ${res.status}: ${path}`);
}

/**
 * Search notes using Obsidian's search API.
 * @param {string} query - Search query string.
 * @returns {Promise<Array>} - Array of matching results.
 */
export async function searchNotes(query) {
  const res = await fetch(`${BASE_URL}/search/simple/?query=${encodeURIComponent(query)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Obsidian search error ${res.status}`);
  return res.json();
}
