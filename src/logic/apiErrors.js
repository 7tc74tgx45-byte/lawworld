// Turn a thrown error from the Claude / Obsidian clients into something Fynn can act on. Pure JS.
// describeError(err) -> { kind, message }

export const OBSIDIAN_CERT_URL = 'https://127.0.0.1:27124';

/** The human message inside an Anthropic error body ({"error":{"message":"..."}}), or ''. */
function claudeBodyMessage(text) {
  const i = text.indexOf('{');
  if (i < 0) return '';
  try {
    const m = JSON.parse(text.slice(i))?.error?.message;
    return typeof m === 'string' ? m.slice(0, 200) : '';
  } catch {
    return '';
  }
}

export function describeError(err) {
  const raw = String(err?.message ?? err ?? '');
  if (err?.name === 'NoOfflineBankError') return { kind: 'no-bank', message: raw };
  if (/No Claude API key/i.test(raw)) return { kind: 'no-key', message: 'No Claude API key is set. Open Settings (Esc) and add one, or continue offline.' };
  if (/No Obsidian token/i.test(raw)) return { kind: 'no-token', message: 'No Obsidian token is set. Open Settings (Esc) and add one, or continue offline.' };

  const c = /Claude API error (\d{3})/i.exec(raw);
  if (c) {
    const code = +c[1];
    const detail = claudeBodyMessage(raw);
    const tail = detail ? ` (${detail})` : '';
    if (code === 401 || code === 403) return { kind: 'claude-auth', message: `Claude rejected the API key${tail}. Check it in Settings.` };
    if (code === 404) return { kind: 'claude-model', message: `Claude does not know that model name${tail}. Check the model in Settings.` };
    if (code === 429) return { kind: 'claude-rate', message: 'Claude says you are sending requests too quickly. Wait a few seconds, then retry.' };
    if (code === 400) return { kind: 'claude-request', message: `Claude refused the request${tail}. If this mentions credit, top up the account.` };
    if (code >= 500) return { kind: 'claude-down', message: `Claude is overloaded or down just now (error ${code}). Retry in a moment.` };
    return { kind: 'claude-other', message: `Claude replied with error ${code}${tail}.` };
  }

  const o = /Obsidian (read|list|write|search) error (\d{3})/i.exec(raw);
  if (o) {
    const code = +o[2];
    if (code === 401 || code === 403) return { kind: 'obsidian-auth', message: 'Obsidian rejected the token. Check it in Settings.' };
    if (code === 404) return { kind: 'obsidian-missing', message: `Obsidian could not find that note in the vault (${raw.split(': ').slice(1).join(': ') || 'unknown file'}). The curriculum may be out of date with your vault.` };
    return { kind: 'obsidian-other', message: `Obsidian replied with error ${code}.` };
  }

  if (err instanceof TypeError || /failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
    return {
      kind: 'network',
      message:
        `Could not reach the tutor's sources. If this is Obsidian: is it open with the Local REST API plugin on, and have you opened ${OBSIDIAN_CERT_URL} once in this browser and accepted the certificate? ` +
        'If this is Claude: check your internet connection.',
    };
  }
  if (/could not read, even after asking again/i.test(raw)) return { kind: 'bad-json', message: raw };
  return { kind: 'unknown', message: `Something went wrong: ${raw || 'unknown error'}` };
}
