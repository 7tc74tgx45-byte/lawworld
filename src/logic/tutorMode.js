// Which tutor provider should an encounter start with? Pure JS.
// Claude needs BOTH a Claude key (to think) and an Obsidian token (to read the note live).
// Otherwise the encounter runs offline from the built-in bank, and says why.

export function chooseMode({ hasClaudeKey, hasObsidianToken, forceOffline, hasOfflineBank }) {
  if (forceOffline) {
    return { mode: 'offline', reason: 'You chose to play offline.' };
  }
  if (!hasClaudeKey && !hasObsidianToken) {
    return { mode: 'offline', reason: 'No Claude key or Obsidian token is set (Esc, Settings), so this uses the built-in question bank.' };
  }
  if (!hasClaudeKey) return { mode: 'offline', reason: 'No Claude API key is set (Esc, Settings), so this uses the built-in question bank.' };
  if (!hasObsidianToken) return { mode: 'offline', reason: 'No Obsidian token is set (Esc, Settings), so the tutor cannot read your note. Using the built-in question bank.' };
  return { mode: 'claude', reason: hasOfflineBank ? 'Claude tutor, reading your note live. Offline bank is the fallback.' : 'Claude tutor, reading your note live. This building has no offline fallback.' };
}
