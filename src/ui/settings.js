// Settings overlay: Claude key + model, Obsidian URL + token, Test connection buttons.
// Values are stored in localStorage via src/settings.js (never in the save file, never in the repo).

import { openOverlay, el, button } from './dom.js';
import { getAllSettings, setSetting, DEFAULT_SETTINGS } from '../settings.js';
import { testClaudeConnection, getClaudeKey } from '../api/claude.js';
import { testConnection as testObsidian } from '../api/obsidian.js';

function field(labelText, { type = 'text', value = '', placeholder = '', id }) {
  const wrap = el('div', 'lw-field');
  const label = el('label', null, labelText);
  const input = document.createElement('input');
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  input.id = id;
  input.autocomplete = 'off';
  input.spellcheck = false;
  label.htmlFor = id;
  wrap.append(label, input);
  return { wrap, input };
}

export function openSettings({ onClosed } = {}) {
  const cur = getAllSettings();
  const { panel, close } = openOverlay({ panelClass: 'medium', onEscape: () => done(), onClosed });
  const done = () => {
    save();
    close();
  };

  const key = field('Claude API key (stored only in this browser)', { type: 'password', value: cur.claudeApiKey, placeholder: 'sk-ant-...', id: 'lw-key' });
  const model = field('Claude model', { value: cur.claudeModel, placeholder: DEFAULT_SETTINGS.claudeModel, id: 'lw-model' });
  const url = field('Obsidian URL', { value: cur.obsidianUrl, placeholder: DEFAULT_SETTINGS.obsidianUrl, id: 'lw-url' });
  const token = field('Obsidian Local REST API token', { type: 'password', value: cur.obsidianToken, placeholder: 'paste the token from the plugin settings', id: 'lw-token' });

  const save = () => {
    setSetting('claudeApiKey', key.input.value.trim());
    setSetting('claudeModel', model.input.value.trim() || DEFAULT_SETTINGS.claudeModel);
    setSetting('obsidianUrl', url.input.value.trim() || DEFAULT_SETTINGS.obsidianUrl);
    setSetting('obsidianToken', token.input.value.trim());
  };

  const status = (text = 'Not tested yet.') => el('div', 'lw-status', text);
  const claudeStatus = status();
  const obsStatus = status();
  const showStatus = (node, res) => {
    node.textContent = res.message;
    node.className = 'lw-status ' + (res.ok ? 'ok' : 'bad');
  };
  const run = async (btn, node, fn) => {
    save();
    btn.disabled = true;
    node.className = 'lw-status';
    node.textContent = 'Testing...';
    try {
      showStatus(node, await fn());
    } catch (e) {
      showStatus(node, { ok: false, message: `Test failed: ${e?.message ?? e}` });
    } finally {
      btn.disabled = false;
    }
  };
  const bClaude = button('Test Claude connection', null, () => run(bClaude, claudeStatus, testClaudeConnection));
  const bObs = button('Test Obsidian connection', null, () => run(bObs, obsStatus, testObsidian));

  const certNote = el('div', 'lw-note');
  certNote.append(
    'Obsidian uses a self-signed certificate. Before the first test, open ',
    Object.assign(el('a', null, 'https://127.0.0.1:27124'), { href: 'https://127.0.0.1:27124', target: '_blank', rel: 'noopener' }),
    ' in a new tab once and accept the warning (in Chrome: Advanced, then Proceed). You should see a short JSON message. Obsidian must be open with the Local REST API plugin enabled.'
  );
  const envNote = el('div', 'lw-note', 'Without a key and token the game still works: encounters use the built-in offline question bank and are labelled OFFLINE. A key in .env is only a dev-server fallback.');
  if (!cur.claudeApiKey && getClaudeKey()) envNote.textContent += ' (A dev .env key is active right now.)';

  const row = (...n) => {
    const r = el('div', 'lw-row');
    r.append(...n);
    return r;
  };
  const bDone = button('Save and close', 'primary', done);
  const bHeading = el('h2', 'lw-h', 'Settings');
  const body = el('div', 'lw-body');
  body.append(
    key.wrap, model.wrap, row(bClaude), claudeStatus,
    url.wrap, token.wrap, row(bObs), obsStatus,
    certNote, envNote, row(bDone),
  );
  panel.append(bHeading, body);
  key.input.focus();
  return { close: done };
}
