// Claude Messages API client (browser).
// Docs: https://docs.anthropic.com/en/api/messages
// The key comes from in-game Settings (localStorage) first. A .env key
// (VITE_CLAUDE_API_KEY) is a dev-only fallback and is ignored in production builds.

import { getSetting, getStoredSetting } from '../settings.js';
import { describeError } from '../logic/apiErrors.js';

export const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
export const DEFAULT_MODEL = 'claude-haiku-5-5';

/** Resolve the API key: Settings first, then .env only when running the dev server. */
export function getClaudeKey() {
  const stored = getStoredSetting('claudeApiKey');
  if (stored) return String(stored).trim();
  if (import.meta.env?.DEV) return (import.meta.env.VITE_CLAUDE_API_KEY || '').trim();
  return '';
}

/** Resolve the model: explicit option, then Settings, then the default. */
export function getClaudeModel() {
  return (getSetting('claudeModel') || '').trim() || DEFAULT_MODEL;
}

/**
 * Call the Messages API.
 * @param {object} req
 * @param {string} [req.system] - System prompt.
 * @param {Array<{role: 'user'|'assistant', content: string|Array}>} req.messages
 * @param {Array<object>} [req.tools] - e.g. [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }]
 * @param {number} [req.maxTokens=1024]
 * @param {string} [req.model]
 * @returns {Promise<{ text: string, content: Array, raw: object }>}
 *   text: all text blocks joined; content: the raw content blocks; raw: the whole response body.
 */
export async function callClaude({ system, messages, tools, maxTokens = 1024, model } = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('callClaude needs a non-empty messages array.');
  }
  const apiKey = getClaudeKey();
  if (!apiKey) {
    throw new Error('No Claude API key. Add one in Settings (or VITE_CLAUDE_API_KEY in .env for local dev).');
  }

  const body = { model: model || getClaudeModel(), max_tokens: maxTokens, messages };
  if (system) body.system = system;
  if (tools && tools.length) body.tools = tools;

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const raw = await res.json();
  const content = Array.isArray(raw.content) ? raw.content : [];
  const text = content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
  return { text, content, raw };
}

/** Tiny live check for the Settings screen (1 token). Returns { ok, message }; never throws. */
export async function testClaudeConnection() {
  if (!getClaudeKey()) return { ok: false, message: 'No Claude API key set. Paste one above first.' };
  try {
    await callClaude({ messages: [{ role: 'user', content: 'Reply with the single word: ok' }], maxTokens: 8 });
    return { ok: true, message: `Connected. Claude answered using model ${getClaudeModel()}.` };
  } catch (e) {
    return { ok: false, message: describeError(e).message };
  }
}

/** Convenience wrapper for a single user prompt; returns just the text. */
export async function askClaude(prompt, opts = {}) {
  const { text } = await callClaude({ ...opts, messages: [{ role: 'user', content: prompt }] });
  return text;
}
