// Pure rules for what the game may write to the Obsidian vault.
// No DOM, no fetch, no import.meta.env: unit-tested in tests/noteGuard.test.js.

export const WRITE_PREFIX = 'TUTOR-SESSION-';
export const PROTECTED_NOTES = ['LAW7054-Tort-Ch8-Breach-Standard-of-Care.md'];

/**
 * Decide whether the game may write a note with this vault path.
 * Allowed: flat filenames starting with TUTOR-SESSION- and ending in .md.
 * Always refused: the protected notes, anything in a folder, anything with path tricks.
 * @param {unknown} filename
 * @returns {{ ok: boolean, reason?: string }}
 */
export function checkWritePath(filename) {
  if (typeof filename !== 'string' || filename.trim() === '') {
    return { ok: false, reason: 'Filename must be a non-empty string.' };
  }

  // Compare the raw name and a percent-decoded form, so '%2e%2e' style tricks can't slip through.
  let decoded = filename;
  try {
    decoded = decodeURIComponent(filename);
  } catch {
    return { ok: false, reason: 'Filename contains invalid percent-encoding.' };
  }

  for (const name of [filename, decoded]) {
    const lower = name.toLowerCase();
    if (PROTECTED_NOTES.some((p) => lower === p.toLowerCase() || lower.endsWith('/' + p.toLowerCase()))) {
      return { ok: false, reason: `${PROTECTED_NOTES[0]} is protected and can never be written.` };
    }
    // eslint-disable-next-line no-control-regex
    if (/[\\/\u0000-\u001f]/.test(name) || name.includes('..')) {
      return { ok: false, reason: 'Filename must be a plain file name in the vault root (no folders or ".." ).' };
    }
    if (!name.startsWith(WRITE_PREFIX)) {
      return { ok: false, reason: `Only files starting with ${WRITE_PREFIX} may be written.` };
    }
    if (!name.toLowerCase().endsWith('.md')) {
      return { ok: false, reason: 'Session notes must end in .md.' };
    }
  }
  return { ok: true };
}

/** Throws if the write is not allowed. */
export function assertWritable(filename) {
  const res = checkWritePath(filename);
  if (!res.ok) throw new Error(`Refusing to write note: ${res.reason}`);
}

/** Encode each path segment separately so '/' separators survive but spaces etc. do not. */
export function encodeVaultPath(path) {
  return String(path)
    .split('/')
    .filter((seg) => seg !== '')
    .map(encodeURIComponent)
    .join('/');
}

/** Strip trailing slashes from a base URL; fall back to the default when blank. */
export function normaliseBaseUrl(url, fallback = 'https://127.0.0.1:27124') {
  const u = typeof url === 'string' ? url.trim() : '';
  return (u || fallback).replace(/\/+$/, '');
}
