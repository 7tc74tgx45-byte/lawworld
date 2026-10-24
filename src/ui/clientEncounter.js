// DOM overlay for a client NPC case (T12): the client tells their problem, the player types advice, the tutor
// evaluates it (IRAC), the client reacts. Same rules as the main encounter (typed advice only, hints nudge,
// "I'm not sure" is useful, leave any time, no skip). It runs the pure client engine in src/logic/clientEncounter.js.
//
//   openClientEncounter({ subsection, tutor, clientName, regionTitle, priorGaps, makeOfflineTutor, onFinish, onClose })
//   onFinish(result) -> { reaction, summary }   called once at the verdict; the scene applies the reward and returns what to show
//   onClose(result)                              the overlay closed (result.finished says whether a verdict was reached)

import { createClientEncounter } from '../logic/clientEncounter.js';
import { describeError } from '../logic/apiErrors.js';
import { viewState, messageView } from '../logic/encounterView.js';
import { openOverlay, el, button } from './dom.js';

let active = null;
export const isClientEncounterOpen = () => !!active;

export function openClientEncounter({ subsection, tutor, clientName = 'The client', regionTitle = '', priorGaps = [], makeOfflineTutor, onOpen, onFinish, onClose }) {
  if (active) return active;
  const engine = createClientEncounter({ subsection, tutor, clientName, priorGaps });
  let busy = false;
  let closed = false;
  let mode = 'answer';
  let kind = 'info';
  let finished = false;
  let reported = false;
  let lastAction = null;

  const { panel, close: closeOverlay } = openOverlay({ panelClass: 'encounter', onEscape: () => {} });
  onOpen?.();

  const head = el('div', 'lw-head');
  const sw = el('div', 'lw-swatch');
  sw.style.background = '#d9a066';
  const who = el('div', 'lw-tutor', `Client: ${clientName}`);
  const tutorTag = el('div', 'lw-title');
  const badge = el('div', 'lw-badge');
  head.append(sw, who, tutorTag, badge);
  const paint = () => {
    panel.style.setProperty('--tc', tutor.colour ?? '#c9a227');
    tutorTag.textContent = `${regionTitle ? regionTitle + ' · ' : ''}${subsection.title} · tutor: ${tutor.name}`;
    badge.textContent = tutor.offline ? 'OFFLINE MODE: built-in case file' : 'ONLINE: Claude reading your note';
    badge.className = 'lw-badge' + (tutor.offline ? '' : ' online');
  };
  paint();

  const transcript = el('div', 'lw-transcript');
  transcript.setAttribute('aria-live', 'polite');
  const errBox = el('div');
  const inputWrap = el('div', 'lw-input');
  const ta = document.createElement('textarea');
  inputWrap.append(ta);
  const note = el('div', 'lw-hint-note', 'Advise the client in IRAC order: Issue, Rule, Application, Conclusion. You must type your advice. Hints nudge and never give the answer. Leaving keeps what you have earned so far.');
  const buttons = el('div', 'lw-buttons');
  const bSubmit = button('Give advice', 'primary');
  const bHint = button('Hint');
  const bNot = button("I'm not sure");
  const bAsk = button('Ask the tutor a question');
  const bLeave = button('Leave', 'leave');
  buttons.append(bSubmit, bHint, bNot, bAsk, bLeave);
  panel.append(head, transcript, errBox, inputWrap, note, buttons);

  const addMsg = (m) => {
    const v = messageView(m, tutor.name, clientName);
    const d = el('div', v.className + (m.kind === 'reaction' ? ' reaction' : ''));
    if (v.label) d.append(el('span', 'lw-label', v.label));
    d.append(document.createTextNode(m.text));
    transcript.append(d);
    transcript.scrollTop = transcript.scrollHeight;
  };

  function render() {
    const v = viewState({ kind: finished ? 'verdict' : 'open', mode, finished });
    inputWrap.style.display = v.showInput ? '' : 'none';
    bSubmit.style.display = v.showSubmit ? '' : 'none';
    bHint.style.display = v.showHint ? '' : 'none';
    bNot.style.display = v.showNotSure ? '' : 'none';
    bAsk.style.display = v.showAsk ? '' : 'none';
    bSubmit.textContent = mode === 'ask' ? 'Send question' : 'Give advice';
    bAsk.textContent = mode === 'ask' ? 'Cancel question' : 'Ask the tutor a question';
    bLeave.textContent = v.leaveLabel;
    ta.placeholder = mode === 'ask' ? 'Ask the tutor anything about this topic...' : 'Type your advice to the client. Enter to submit, Shift+Enter for a new line.';
    if (v.showInput) ta.focus();
  }

  function sync(res) {
    if (closed) return;
    res?.messages?.forEach(addMsg);
    finished = !!res?.done;
    render();
    if (finished) finish();
  }

  function finish() {
    if (reported) return;
    reported = true;
    const shown = onFinish?.(engine.result());
    if (shown?.reaction) addMsg({ role: 'client', kind: 'reaction', text: shown.reaction });
    if (shown?.summary) {
      transcript.append(el('div', 'lw-reward', shown.summary));
      transcript.scrollTop = transcript.scrollHeight;
    }
  }

  const setBusy = (on) => {
    busy = on;
    for (const b of [bSubmit, bHint, bNot, bAsk]) b.disabled = on;
    ta.disabled = on;
  };

  async function run(fn) {
    if (busy || closed) return null;
    lastAction = fn;
    errBox.textContent = '';
    setBusy(true);
    const thinking = el('div', 'lw-msg thinking');
    thinking.append(`${tutor.name} is thinking`);
    transcript.append(thinking);
    transcript.scrollTop = transcript.scrollHeight;
    try {
      const res = await fn();
      thinking.remove();
      if (res && res.ok !== false && mode === 'ask') mode = 'answer';
      if (res?.rejected && res.messages?.length) {
        if (!closed) res.messages.forEach(addMsg);
        return res;
      }
      sync(res);
      return res;
    } catch (e) {
      thinking.remove();
      showError(e);
      return null;
    } finally {
      if (!closed) {
        setBusy(false);
        if (!finished && inputWrap.style.display !== 'none') ta.focus();
      }
    }
  }

  function showError(e) {
    const info = describeError(e);
    const box = el('div', 'lw-error');
    box.append(el('div', null, info.message));
    const row = el('div', 'row');
    row.append(button('Retry', 'primary', () => run(lastAction)));
    // Offline can only take over before the client has spoken (the scenario belongs to the tutor that wrote it).
    if (!tutor.offline && makeOfflineTutor && !engine.started()) row.append(button('Continue offline', null, continueOffline));
    box.append(row);
    errBox.append(box);
  }

  async function continueOffline() {
    let t;
    try {
      t = makeOfflineTutor();
      engine.switchTutor(t);
    } catch (err) {
      errBox.textContent = '';
      showError(err);
      return;
    }
    tutor = t;
    paint();
    errBox.textContent = '';
    run(() => engine.start());
  }

  function doSubmit() {
    const text = ta.value;
    if (!text.trim()) return null;
    const asking = mode === 'ask';
    ta.value = '';
    return run(async () => {
      const r = asking ? await engine.ask(text) : await engine.submit(text);
      if (r.rejected) ta.value = text;
      return r;
    });
  }

  bSubmit.onclick = doSubmit;
  bHint.onclick = () => run(() => engine.hint());
  bNot.onclick = () => run(() => engine.notSure());
  bAsk.onclick = () => {
    mode = mode === 'ask' ? 'answer' : 'ask';
    render();
  };
  bLeave.onclick = () => close();
  ta.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      doSubmit();
    }
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
  render();
  run(() => engine.start());
  return active;
}
