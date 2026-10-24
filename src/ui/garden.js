// Garden overlay (T13): plant a seed (choose what to remember) or water a plant (answer a retrieval question).
// Rules live in src/logic/garden.js and retrieval.js. Nothing grows without a typed answer.
//   openGarden({ plotId, save, curriculum, tutorFor, onChange }) -> { close }
//   onChange(fn) lets the scene update the save: fn(save) -> { save, ... }

import { openOverlay, el, button } from './dom.js';
import { retrievalTargets, plotStatus, plantSeed, waterPlot, gardenOf, STAGE_NAMES, MAX_STAGE } from '../logic/garden.js';
import { retrievalQuestion, evaluateRetrievalOffline } from '../logic/retrieval.js';
import { findSubsection } from '../logic/curriculum.js';
import { describeError } from '../logic/apiErrors.js';

export function openGarden({ plotId, getSave, curriculum, makeTutor, update, onDone }) {
  const { panel, close } = openOverlay({ panelClass: 'medium', onEscape: () => close() });
  const save = getSave();
  const plot = gardenOf(save).find((p) => p.id === plotId);
  panel.append(el('h2', 'lw-h', 'Knowledge garden'));
  const body = el('div', 'lw-garden');
  panel.append(body);
  const done = (msg) => { onDone?.(msg); close(); };
  const closeBtn = () => button('Leave', 'leave', close);

  if (!plot) return plantView();
  return waterView();

  function plantView() {
    const seeds = save.inventory?.seeds ?? 0;
    body.append(el('p', null, `An empty plot. You have ${seeds} seed${seeds === 1 ? '' : 's'}. Seeds come from solid answers in the buildings.`));
    const targets = retrievalTargets(curriculum, save.progress, gardenOf(save));
    if (!seeds) { body.append(el('p', 'lw-jhint', 'Answer solidly in a study building to earn a seed.'), closeBtn()); return; }
    if (!targets.length) { body.append(el('p', 'lw-jhint', 'Nothing to plant for yet: consolidate a subsection, or let a gap appear first.'), closeBtn()); return; }
    body.append(el('p', 'lw-jhint', 'Choose what this plant will make you remember. Open gaps come first.'));
    for (const t of targets.slice(0, 6)) {
      const sub = findSubsection(curriculum, t.subsectionId);
      body.append(button(`${t.kind === 'gap' ? 'Gap: ' : ''}${t.concept} (${sub?.title ?? t.subsectionId})`, null, () => {
        const r = update((s) => plantSeed(s, plotId, t));
        done(r.ok ? `Planted: ${t.concept}. Water it by answering a question before it withers.` : 'Could not plant that.');
      }));
    }
    body.append(closeBtn());
  }

  function waterView() {
    const sub = findSubsection(curriculum, plot.subsectionId);
    const status = plotStatus(plot, Date.now());
    body.append(el('p', null, `${plot.concept}: ${STAGE_NAMES[plot.stage]}${status === 'withered' ? ' (withered: answer to revive it)' : ''}`));
    if (plot.stage >= MAX_STAGE && status !== 'withered') {
      body.append(el('p', 'lw-jhint', 'This tree is fully grown. Come back and water it before it withers to keep it.'));
    }
    body.append(el('p', null, retrievalQuestion(plot, sub)));
    const log = el('div', 'lw-hint-note');
    const ta = document.createElement('textarea');
    ta.rows = 5;
    ta.style.width = '100%';
    ta.placeholder = 'Type your answer. Enter to submit, Shift+Enter for a new line.';
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
    });
    const row = el('div', 'lw-buttons');
    const bGo = button('Water with my answer', 'primary', submit);
    const bNot = button("I'm not sure", null, () => finish('missing', `Noted: "${plot.concept}" stays on your revisit list. The plant is not watered.`));
    row.append(bGo, bNot, closeBtn());
    body.append(ta, log, row);
    ta.focus();

    function finish(verdict, feedback) {
      const r = update((s) => waterPlot(s, plotId, verdict));
      const tail = verdict === 'solid' ? (r.grew ? ' It grew a stage.' : r.revived ? ' It revived.' : '') : '';
      done(`${feedback}${tail}`);
    }

    async function submit() {
      const text = ta.value.trim();
      if (text.length < 15) { log.textContent = 'Write a sentence or two (at least 15 characters). That was not counted.'; return; }
      bGo.disabled = bNot.disabled = true;
      log.textContent = 'Checking...';
      try {
        const tutor = makeTutor?.();
        let ev;
        if (tutor && !tutor.offline) {
          const prompt = { kind: 'open', text: retrievalQuestion(plot, sub) };
          ev = await tutor.evaluate(2, prompt, text, { subsection: sub, answers: [text], followUpsUsed: 0, notSure: false, priorGaps: [] });
        } else {
          ev = evaluateRetrievalOffline(text, plot, sub);
          if (ev.rejected) { log.textContent = ev.feedback; bGo.disabled = bNot.disabled = false; return; }
          ev.feedback = `OFFLINE CHECK. ${ev.feedback}`;
        }
        finish(ev.verdict, ev.feedback);
      } catch (e) {
        log.textContent = describeError(e).message;
        bGo.disabled = bNot.disabled = false;
      }
    }
  }
}
