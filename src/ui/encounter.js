// DOM overlay for an encounter. Text input lives in the DOM, never in Phaser.
//
//   openEncounter({ subsection, tutor, priorGaps, onOpen, onClose, onFinish, makeOfflineTutor }) -> { close, engine }
//
// The shared overlay lock (ui/dom.js) disables Phaser keyboard input and releases key captures while this is open,
// and restores them when it closes, so W/A/S/D/Space can be typed into the answer box.
// onFinish(result) fires once when the verdict is reached (the scene writes progress + save there).
// onClose(result) fires when the overlay closes (Leave / Close); result.finished tells whether a verdict was reached.

import { createEncounter, STAGES } from '../logic/encounter.js';
import { describeError } from '../logic/apiErrors.js';
import { viewState, messageView, pipStates } from '../logic/encounterView.js';
import { openOverlay, el, button } from './dom.js';
import { getPortrait } from './portraits.js';
import { sfx } from '../audio/sfx.js';
import { evaluationSound } from '../logic/sfx.js';

let active = null;

export function isEncounterOpen() {
  return !!active;
}

// payForHint() -> { ok, message?, refund?() } and hintOffer() -> { text, canAfford } come from the scene (T21): materials
// buy an extra hint once the free ones for a stage are used. The overlay never touches the inventory itself.
export function openEncounter({ subsection, tutor, priorGaps, loadMemory, onOpen, onClose, onFinish, makeOfflineTutor, payForHint, hintOffer }) {
  if (active) return active;
  const engine = createEncounter({ subsection, tutor, priorGaps, loadMemory, payForHint });
  let busy = false;
  let closed = false;
  let mode = 'answer'; // 'answer' | 'ask'
  let stage = 1;
  let kind = 'info';
  let finished = false;
  let reported = false;
  let lastAction = null;
  let lastFailed = false;

  const { overlay, panel, close: closeOverlay } = openOverlay({
    panelClass: 'encounter',
    onEscape: () => {}, // Esc must not close the encounter by accident: use the Leave button
  });
  onOpen?.();

  // ---- header: portrait swatch, tutor name, title, offline badge
  const head = el('div', 'lw-head');
  const portraitHolder = el('div', 'lw-portrait-frame'); // the frame border carries the tutor colour
  const tutorLabel = el('div', 'lw-tutor');
  const badge = el('div', 'lw-badge');
  head.append(portraitHolder, tutorLabel, el('div', 'lw-title', `${subsection.module ?? ''}: ${subsection.title}`), badge);
  const paintTutor = () => {
    const c = tutor.colour ?? '#c9a227';
    panel.style.setProperty('--tc', c);
    portraitHolder.textContent = '';
    portraitHolder.append(getPortrait(tutor.id)); // swaps with the tutor (e.g. Continue offline)
    tutorLabel.textContent = tutor.name;
    badge.textContent = tutor.offline ? 'OFFLINE MODE: built-in question bank' : 'ONLINE: Claude reading your note';
    badge.className = 'lw-badge' + (tutor.offline ? '' : ' online');
  };
  paintTutor();

  const pips = el('div', 'lw-pips');
  const transcript = el('div', 'lw-transcript');
  transcript.setAttribute('aria-live', 'polite');
  const errBox = el('div');
  const options = el('div', 'lw-options');
  const inputWrap = el('div', 'lw-input');
  const ta = document.createElement('textarea');
  inputWrap.append(ta);
  const note = el('div', 'lw-hint-note', 'Every step needs a typed answer (or a choice). Hints nudge, they never give the answer. Leaving keeps your progress.');
  const buttons = el('div', 'lw-buttons');
  const bSubmit = button('Submit', 'primary');
  const bHint = button('Hint');
  const bExtra = button('Extra hint');
  bExtra.style.display = 'none';
  const bNot = button("I'm not sure");
  const bAsk = button('Ask a question');
  const bLeave = button('Leave', 'leave');
  buttons.append(bSubmit, bHint, bExtra, bNot, bAsk, bLeave);
  panel.append(head, pips, transcript, errBox, options, inputWrap, note, buttons);

  // ---- rendering
  function renderPips() {
    pips.textContent = '';
    pipStates(stage, finished).forEach((state, i) => {
      const p = el('span', 'lw-pip ' + state, state === 'todo' ? '○' : '●');
      p.title = `${STAGES[i].n}. ${STAGES[i].label}`;
      pips.append(p);
    });
    pips.append(el('div', 'lw-stage-name', finished ? 'Complete' : `${stage}. ${STAGES[stage - 1].label}`));
  }

  function addMsg(m) {
    const v = messageView(m, tutor.name);
    const d = el('div', v.className);
    if (v.label) d.append(el('span', 'lw-label', v.label));
    d.append(document.createTextNode(m.text));
    transcript.append(d);
    transcript.scrollTop = transcript.scrollHeight;
  }

  function renderOptions(prompt) {
    options.textContent = '';
    if (kind !== 'mcq' || finished || !prompt?.options) return;
    prompt.options.forEach((o, i) => {
      const b = el('button', 'lw-opt', `${String.fromCharCode(65 + i)}. ${o}`);
      b.type = 'button';
      b.onclick = () => {
        mode = 'answer';
        run(() => engine.submit(i));
      };
      options.append(b);
    });
  }

  // The paid hint only appears after the free hints for this stage / question are used, and only while extras remain.
  function renderExtra(v) {
    const h = engine.status().hints;
    const show = !!payForHint && v.showHint && !finished && mode !== 'ask' && h.free === 0 && h.extra > 0;
    bExtra.style.display = show ? '' : 'none';
    if (!show) return;
    const offer = hintOffer?.() ?? { text: 'Extra hint (costs materials)', canAfford: true };
    bExtra.textContent = offer.text;
    bExtra.classList.toggle('poor', !offer.canAfford);
    bExtra.title = 'A further Socratic nudge, paid for with materials. It never gives the answer and does not change how your answer is judged.';
  }

  function render() {
    const v = viewState({ kind, mode, finished });
    options.style.display = v.showOptions ? '' : 'none';
    inputWrap.style.display = v.showInput ? '' : 'none';
    bSubmit.style.display = v.showSubmit ? '' : 'none';
    bHint.style.display = v.showHint ? '' : 'none';
    bNot.style.display = v.showNotSure ? '' : 'none';
    bAsk.style.display = v.showAsk ? '' : 'none';
    bSubmit.textContent = v.submitLabel;
    bAsk.textContent = v.askLabel;
    bLeave.textContent = v.leaveLabel;
    ta.placeholder = v.placeholder;
    renderPips();
    renderExtra(v);
    if (v.showInput) ta.focus();
    else if (v.showSubmit) bSubmit.focus();
  }

  let currentPrompt = null;
  function sync(res) {
    if (closed) return; // the player left while the tutor was thinking: the overlay is gone
    // Chime for a solid/correct answer, thud for a missing/wrong one. Consolidation gets the fanfare instead of the last chime.
    const consolidated = !!res?.done && !reported && engine.result().outcome === 'consolidated';
    const heard = consolidated ? 'fanfare' : evaluationSound(res?.evaluation);
    if (heard) sfx.play(heard);
    res?.messages?.forEach(addMsg);
    stage = res?.stage ?? stage;
    if (res?.prompt) {
      currentPrompt = res.prompt;
      kind = res.prompt.kind ?? kind;
    }
    finished = !!res?.done;
    renderOptions(currentPrompt);
    render();
    if (finished) finish();
  }

  function finish() {
    if (reported) return;
    reported = true;
    onFinish?.(engine.result());
  }

  // ---- running engine calls with a loading state and a readable error
  const setBusy = (on) => {
    busy = on;
    for (const b of [bSubmit, bHint, bNot, bAsk]) b.disabled = on;
    for (const b of options.querySelectorAll('button')) b.disabled = on;
    ta.disabled = on;
  };

  async function run(fn) {
    if (busy || closed) return null;
    lastAction = fn;
    errBox.textContent = '';
    setBusy(true);
    const thinking = el('div', 'lw-msg thinking');
    thinking.append(`${tutor.name} is thinking`);
    const dots = el('span', 'lw-dots');
    dots.innerHTML = '<span>.</span><span>.</span><span>.</span>';
    thinking.append(dots);
    transcript.append(thinking);
    transcript.scrollTop = transcript.scrollHeight;
    try {
      const res = await fn();
      thinking.remove();
      lastFailed = false;
      if (res && res.ok !== false && mode === 'ask') mode = 'answer';
      if (res?.rejected && res.messages?.length) {
        // A gentle rejection (too short, nothing to answer): show it, keep the typed text.
        if (!closed) { res.messages.forEach(addMsg); renderExtra(viewState({ kind, mode, finished })); }
        return res;
      }
      sync(res);
      return res;
    } catch (e) {
      thinking.remove();
      lastFailed = true;
      e?.messages?.forEach(addMsg); // what was already said (the answer, feedback) stays visible
      showError(e);
      return null;
    } finally {
      if (!closed) {
        setBusy(false);
        if (!ta.disabled && inputWrap.style.display !== 'none') ta.focus();
      }
    }
  }

  // Retry re-runs the same action. If the engine already counted the answer and only the next prompt failed,
  // retry fetches that prompt (next) instead of submitting the answer twice.
  function showError(e) {
    const info = describeError(e);
    errBox.textContent = '';
    const box = el('div', 'lw-error');
    box.append(el('div', null, info.message));
    const row = el('div', 'row');
    row.append(button('Retry', 'primary', () => run(engine.hasPending() ? () => engine.next() : lastAction)));
    if (!tutor.offline && makeOfflineTutor) {
      row.append(button('Continue offline', null, continueOffline));
    }
    box.append(row);
    errBox.append(box);
  }

  async function continueOffline() {
    let t;
    try {
      t = makeOfflineTutor();
    } catch (err) {
      showError(err);
      return;
    }
    const before = tutor;
    tutor = t;
    paintTutor();
    const res = await run(() => engine.switchTutor(t));
    if (!res && lastFailed) {
      // The offline bank could not take over (e.g. it does not cover this building): go back to the previous tutor.
      tutor = before;
      paintTutor();
    }
  }

  // ---- input handling
  function doSubmit() {
    if (kind === 'info' && mode !== 'ask') return run(() => engine.next());
    if (kind === 'mcq' && mode !== 'ask') return null;
    const text = ta.value;
    if (!text.trim()) return null;
    if (mode === 'ask') {
      ta.value = '';
      return run(async () => {
        const r = await engine.ask(text);
        if (r.rejected) ta.value = text;
        return r;
      });
    }
    ta.value = '';
    return run(async () => {
      const r = await engine.submit(text);
      if (r.rejected) ta.value = text; // keep what they typed so they can extend it
      return r;
    });
  }

  bSubmit.onclick = doSubmit;
  bHint.onclick = () => run(() => engine.hint());
  bExtra.onclick = () => run(() => engine.extraHint());
  bNot.onclick = () => run(() => engine.notSure());
  bAsk.onclick = () => {
    mode = mode === 'ask' ? 'answer' : 'ask';
    render();
  };
  bLeave.onclick = () => close();

  ta.addEventListener('keydown', (e) => {
    e.stopPropagation(); // keep typed keys away from any game listeners
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      doSubmit();
    }
  });

  function close() {
    if (closed) return;
    closed = true;
    const res = engine.leave();
    closeOverlay(); // releases the keyboard lock
    active = null;
    onClose?.(res);
  }

  active = { close, engine, overlay };
  render();
  run(() => engine.next());
  return active;
}
