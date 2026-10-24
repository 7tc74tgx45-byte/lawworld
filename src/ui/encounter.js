// DOM overlay for an encounter. Text input lives in the DOM, never in Phaser.
// openEncounter({ subsection, tutor, onOpen, onClose }) -> { close }
// onOpen/onClose let the scene disable and restore Phaser keyboard input.

import { createEncounter, STAGES } from '../logic/encounter.js';
import { describeError } from '../logic/apiErrors.js';
import { openOverlay, el } from './dom.js';

let active = null;

export function isEncounterOpen() {
  return !!active;
}

// makeOfflineTutor() (optional) builds the offline tutor for "continue offline" after a failed Claude call.
export function openEncounter({ subsection, tutor, priorGaps, onOpen, onClose, onFinish, makeOfflineTutor }) {
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
  const badge = el('div', 'lw-badge');
  const setBadge = () => {
    badge.textContent = tutor.offline ? 'OFFLINE MODE: built-in question bank' : 'ONLINE: Claude reading your note';
    badge.className = 'lw-badge' + (tutor.offline ? '' : ' online');
  };
  setBadge();
  head.append(badge);

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

  const errBox = el('div');
  let lastAction = null;
  panel.append(head, pips, transcript, errBox, options, inputWrap, note, buttons);

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
    lastAction = fn;
    errBox.textContent = '';
    for (const b of buttons.querySelectorAll('button')) if (b !== bLeave) b.disabled = true;
    for (const b of options.querySelectorAll('button')) b.disabled = true;
    const thinking = el('div', 'lw-msg thinking');
    thinking.append(`${tutor.name} is thinking`, Object.assign(el('span', 'lw-dots'), { innerHTML: '<span>.</span><span>.</span><span>.</span>' }));
    transcript.append(thinking);
    transcript.scrollTop = transcript.scrollHeight;
    try {
      const res = await fn();
      thinking.remove();
      if (res && res.ok !== false && mode === 'ask') mode = 'answer';
      sync(res);
    } catch (e) {
      thinking.remove();
      e?.messages?.forEach(addMsg); // what was already said (the answer, feedback) stays visible
      showError(e);
    } finally {
      busy = false;
      for (const b of buttons.querySelectorAll('button')) b.disabled = false;
      for (const b of options.querySelectorAll('button')) b.disabled = false;
      if (!inputWrap.style.display) ta.focus();
    }
  }

  // After a failure: Retry re-runs the same action. If the engine already counted the answer and only
  // the next prompt failed, retry fetches that prompt (next) instead of submitting the answer twice.
  function showError(e) {
    const info = describeError(e);
    errBox.textContent = '';
    const box = el('div', 'lw-error');
    box.append(el('div', null, info.message));
    const row = el('div', 'row');
    const retry = el('button', 'lw-btn primary', 'Retry');
    retry.type = 'button';
    retry.onclick = () => run(engine.hasPending() ? () => engine.next() : lastAction);
    row.append(retry);
    if (!tutor.offline && makeOfflineTutor) {
      const off = el('button', 'lw-btn', 'Continue offline');
      off.type = 'button';
      off.onclick = () => {
        let t;
        try {
          t = makeOfflineTutor();
        } catch (err) {
          errBox.textContent = '';
          errBox.append(Object.assign(el('div', 'lw-error'), { textContent: describeError(err).message }));
          return;
        }
        tutor = t;
        tutorLabel.textContent = t.name;
        setBadge();
        panel.style.setProperty('--tc', tutor.colour ?? '#c9a227');
        sw.style.background = tutor.colour ?? '#c9a227';
        errBox.textContent = '';
        run(() => engine.switchTutor(t));
      };
      row.append(off);
    }
    box.append(row);
    errBox.append(box);
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
    closeOverlay();
    active = null;
    onClose?.(res);
  }

  active = { close, engine };
  run(() => engine.next());
  return active;
}
