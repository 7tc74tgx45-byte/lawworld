// DOM overlay for an encounter. Text input lives in the DOM, never in Phaser.
// openEncounter({ subsection, tutor, onOpen, onClose }) -> { close }
// onOpen/onClose let the scene disable and restore Phaser keyboard input.

import './encounter.css';
import { createEncounter, STAGES } from '../logic/encounter.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

let active = null;

export function isEncounterOpen() {
  return !!active;
}

export function openEncounter({ subsection, tutor, priorGaps, onOpen, onClose, onFinish }) {
  if (active) return active;
  const engine = createEncounter({ subsection, tutor, priorGaps });
  let busy = false;
  let closed = false;
  let mode = 'answer'; // 'answer' | 'ask'
  let stage = 1;
  let currentKind = 'info';
  let finished = false;

  onOpen?.();

  const overlay = el('div', 'lw-overlay');
  const panel = el('div', 'lw-panel');
  panel.style.setProperty('--tc', tutor.colour ?? '#c9a227');

  const head = el('div', 'lw-head');
  const sw = el('div', 'lw-swatch');
  sw.style.background = tutor.colour ?? '#c9a227';
  head.append(sw, el('div', 'lw-tutor', tutor.name), el('div', 'lw-title', `${subsection.module}: ${subsection.title}`));
  if (tutor.offline) head.append(el('div', 'lw-badge', 'OFFLINE MODE: built-in question bank'));

  const pips = el('div', 'lw-pips');
  const stageName = el('div', 'lw-stage-name');
  const transcript = el('div', 'lw-transcript');
  const options = el('div', 'lw-options');
  const inputWrap = el('div', 'lw-input');
  const ta = document.createElement('textarea');
  ta.placeholder = 'Type your answer here. Enter to submit, Shift+Enter for a new line.';
  inputWrap.append(ta);

  const buttons = el('div', 'lw-buttons');
  const mk = (label, cls) => buttons.appendChild(el('button', 'lw-btn' + (cls ? ' ' + cls : ''), label));
  const bSubmit = mk('Submit', 'primary');
  const bHint = mk('Hint');
  const bNot = mk("I'm not sure");
  const bAsk = mk('Ask a question');
  const bLeave = mk('Leave', 'leave');
  bSubmit.type = bHint.type = bNot.type = bAsk.type = bLeave.type = 'button';
  const note = el('div', 'lw-hint-note', 'Every step needs a typed answer (or a choice). Hints nudge, they never give the answer. Leaving keeps your progress.');

  panel.append(head, pips, transcript, options, inputWrap, note, buttons);
  overlay.append(panel);
  document.body.append(overlay);

  function renderPips() {
    pips.textContent = '';
    for (const s of STAGES) {
      const p = el('span', 'lw-pip ' + (s.n < stage || finished ? 'done' : s.n === stage ? 'now' : ''), s.n === stage && !finished ? '●' : s.n < stage || finished ? '●' : '○');
      p.title = `${s.n}. ${s.label}`;
      pips.append(p);
    }
    stageName.textContent = finished ? 'Complete' : `${stage}. ${STAGES[stage - 1].label}`;
    pips.append(stageName);
  }

  function addMsg(m) {
    const cls = ['lw-msg', m.role === 'tutor' ? 'tutor' : m.role === 'player' ? 'player' : 'system'];
    if (m.kind === 'hint') cls.push('hint');
    if (m.kind === 'answer') cls.push('answer');
    if (m.kind === 'verdict') cls.push('verdict');
    if (m.correct === true) cls.push('correct');
    if (m.correct === false) cls.push('wrong');
    const d = el('div', cls.join(' '));
    if (m.role === 'tutor') d.append(el('span', 'lw-label', m.kind === 'hint' ? 'Hint' : m.kind === 'answer' ? 'Answer to your question' : tutor.name));
    d.append(document.createTextNode(m.text));
    transcript.append(d);
    transcript.scrollTop = transcript.scrollHeight;
  }

  function sync(res) {
    if (res?.messages) res.messages.forEach(addMsg);
    stage = res?.stage ?? stage;
    currentKind = res?.prompt?.kind ?? currentKind;
    finished = !!res?.done;
    options.textContent = '';
    const isMcq = currentKind === 'mcq' && !finished;
    if (isMcq) {
      res.prompt.options.forEach((o, i) => {
        const b = el('button', 'lw-opt', `${String.fromCharCode(65 + i)}. ${o}`);
        b.type = 'button';
        b.onclick = () => run(() => engine.submit(i));
        options.append(b);
      });
    }
    const info = currentKind === 'info';
    inputWrap.style.display = isMcq || info || finished ? 'none' : '';
    bSubmit.textContent = info ? 'Continue' : mode === 'ask' ? 'Send question' : 'Submit';
    bSubmit.style.display = isMcq || finished ? 'none' : '';
    for (const b of [bHint, bNot]) b.style.display = finished || info ? 'none' : '';
    bAsk.style.display = finished ? 'none' : '';
    bAsk.textContent = mode === 'ask' ? 'Cancel question' : 'Ask a question';
    bLeave.textContent = finished ? 'Close' : 'Leave';
    ta.placeholder = mode === 'ask' ? 'Ask the tutor anything about this topic...' : 'Type your answer here. Enter to submit, Shift+Enter for a new line.';
    renderPips();
    if (!inputWrap.style.display) ta.focus();
    if (finished) finish();
  }

  let reported = false;
  function finish() {
    if (reported) return;
    reported = true;
    onFinish?.(engine.result());
  }

  async function run(fn) {
    if (busy || closed) return;
    busy = true;
    for (const b of buttons.querySelectorAll('button')) if (b !== bLeave) b.disabled = true;
    try {
      const res = await fn();
      if (res && res.ok !== false && mode === 'ask') mode = 'answer';
      sync(res);
    } catch (e) {
      addMsg({ role: 'system', text: `Something went wrong: ${e.message}` });
    } finally {
      busy = false;
      for (const b of buttons.querySelectorAll('button')) b.disabled = false;
      if (!inputWrap.style.display) ta.focus();
    }
  }

  function doSubmit() {
    if (currentKind === 'info') return run(() => engine.next());
    if (currentKind === 'mcq' && mode !== 'ask') return;
    const text = ta.value;
    if (mode === 'ask') {
      if (!text.trim()) return;
      ta.value = '';
      return run(() => engine.ask(text));
    }
    if (!text.trim()) return;
    ta.value = '';
    return run(async () => {
      const r = await engine.submit(text);
      if (r.rejected) ta.value = text; // keep what they typed so they can extend it
      return r;
    });
  }

  bSubmit.onclick = doSubmit;
  bHint.onclick = () => run(() => engine.hint());
  bNot.onclick = () => run(() => engine.notSure());
  bAsk.onclick = () => {
    mode = mode === 'ask' ? 'answer' : 'ask';
    if (currentKind === 'mcq') {
      // MCQ has no textbox: show it for the question, then hide again after.
      inputWrap.style.display = mode === 'ask' ? '' : 'none';
      bSubmit.style.display = mode === 'ask' ? '' : 'none';
      bSubmit.textContent = 'Send question';
      bAsk.textContent = mode === 'ask' ? 'Cancel question' : 'Ask a question';
      ta.placeholder = 'Ask the tutor anything about this topic...';
      if (mode === 'ask') ta.focus();
      return;
    }
    sync({ stage, prompt: { kind: currentKind }, done: finished });
  };
  bLeave.onclick = () => close();

  ta.addEventListener('keydown', (e) => {
    e.stopPropagation(); // keep typed keys away from any game listeners
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSubmit();
    }
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') e.stopPropagation();
  });

  function close() {
    if (closed) return;
    closed = true;
    const res = engine.leave();
    overlay.remove();
    active = null;
    onClose?.(res);
  }

  active = { close, engine };
  run(() => engine.next());
  return active;
}
