// Claude API client
// Docs: https://docs.anthropic.com/en/api/getting-started

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Send a message to Claude and get a response.
 * @param {string} prompt - The user message to send.
 * @param {object} [options]
 * @param {string} [options.model='claude-opus-4-5'] - Claude model to use.
 * @param {number} [options.maxTokens=1024] - Max tokens to return.
 * @returns {Promise<string>} - The assistant's reply text.
 */
export async function askClaude(prompt, { model = 'claude-opus-4-5', maxTokens = 1024 } = {}) {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;
  if (!apiKey) throw new Error('VITE_CLAUDE_API_KEY is not set in .env');

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content[0].text;
}
