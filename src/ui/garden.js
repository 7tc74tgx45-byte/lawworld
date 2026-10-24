// Garden overlay (T13): plant a seed (choose what to remember) or water a plant (answer a retrieval question).
// Rules live in src/logic/garden.js and retrieval.js. Nothing grows without a typed answer; there is no skip.
//   openGarden({ plotId, getSave, curriculum, makeTutor, update, onDone }) -> { close }
//   update(fn): fn(save) -> { ok, save, grew?, revived? }; the scene stores the result and returns it.
//   makeTutor(): a Claude tutor (has .retrieve) or null for the labelled offline check.

import { openOverlay, el, button } from './dom.js';
import { retrievalTargets, plotStatus, plantSeed, waterPlot, dampRemainingMs, gardenOf, STAGE_NAMES, MAX_STAGE } from '../logic/garden.js';
import { planRetrieval, kindLabel, evaluateRetrievalOffline, evaluateRetrievalItem, retrievalHint } from '../logic/retrieval.js';
import { RETRIEVAL_BANK } from '../data/retrievalBank.js';
import { findSubsection } from '../logic/curriculum.js';
import { describeError } from '../logic/apiErrors.js';
import { MIN_ANSWER_CHARS, MIN_QUESTION_CHARS } from '../logic/encounterRules.js';

export function openGarden({ plotId, getSave, curriculum, makeTutor, update, onDone }) {
  const { panel, close } = openOverlay({ panelClass: 'medium', onEscape: () => close() });
  const save = getSave();
  const plot = gardenOf(save).find((p) => p.id === plotId);
  panel.append(el('h2', 'lw-h', 'Knowledge garden'));
  const body = el('div', 'lw-body lw-garden');
  panel.append(body);
  const closeBtn = (label = 'Leave') => button(label, 'leave', close);

  if (!plot) plantView();
  else waterView();
  return { close };

  function plantView() {
    const seeds = save.inventory?.seeds ?? 0;
    body.append(el('p', null, `An empty plot. You have ${seeds} seed${seeds === 1 ? '' : 's'}. Seeds come only from solid answers in the buildings.`));
    const targets = retrievalTargets(curriculum, save.progress, gardenOf(save));
    if (!seeds) { body.append(el('p', 'lw-jhint', 'Answer solidly in a study building to earn a seed.'), closeBtn()); return; }
    if (!targets.length) { body.append(el('p', 'lw-jhint', 'Nothing to plant for yet: consolidate a subsection, or let a gap appear first.'), closeBtn()); return; }
    body.append(el('p', 'lw-jhint', 'Choose what this plant will make you remember. Open gaps come first, then consolidated topics you have not seen for longest.'));
    for (const t of targets.slice(0, 6)) {
      const sub = findSubsection(curriculum, t.subsectionId);
      body.append(button(`${t.kind === 'gap' ? 'Gap: ' : ''}${t.concept} (${sub?.title ?? t.subsectionId})`, null, () => {
        const r = update((s) => plantSeed(s, plotId, t));
        onDone?.(r.ok ? `Planted: ${t.concept}. Water it by answering a question before it withers.` : 'Could not plant that.');
        close();
      }));
    }
    body.append(closeBtn());
  }

  function waterView() {
    const sub = findSubsection(curriculum, plot.subsectionId);
    const now = Date.now();
    const status = plotStatus(plot, now);
    body.append(el('p', null, `${plot.concept}: ${STAGE_NAMES[plot.stage]}${status === 'withered' ? ' (withered: a solid answer revives it)' : ''}`));
    const damp = dampRemainingMs(plot, now);
    if (damp > 0) {
      body.append(el('p', 'lw-jhint', `The soil is still damp. Come back in about ${Math.ceil(damp / 60000)} minute(s): spaced retrieval works because you leave a gap.`), closeBtn());
      return;
    }
    if (plot.stage >= MAX_STAGE && status !== 'withered') body.append(el('p', 'lw-jhint', 'Fully grown. Water it again before it withers to keep the tree.'));
    const tutor = makeTutor?.() ?? null;
    const claude = !!(tutor && !tutor.offline && tutor.retrieve);
    // The question kind rotates each round (rule, case, apply-to-facts). Offline, a banked building gets a concrete banked question.
    const plan = planRetrieval(plot, sub, { bank: RETRIEVAL_BANK[plot.subsectionId], useBank: !claude });
    const question = plan.question;
    body.append(el('p', 'lw-jhint', `Retrieval round ${(plot.waterings ?? 0) + 1}: a ${kindLabel(plan.kind)}.`), el('p', null, question));
    if (!claude) body.append(el('p', 'lw-jhint', 'OFFLINE CHECK: no Claude key and Obsidian token, so answers are judged by simple keyword matching.'));
    const ctx = { subsection: sub, answers: [], followUpsUsed: 0, notSure: false, priorGaps: [], memory: [] };
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
    const bHint = button('Hint', null, hint);
    const bAsk = button('Ask a question', null, ask);
    const bNot = button("I'm not sure", null, notSure);
    row.append(bGo, bHint, ...(claude ? [bAsk] : []), bNot, closeBtn());
    body.append(ta, log, row);
    ta.focus();
    let hints = 0;
    const lock = (on) => { for (const b of [bGo, bHint, bAsk, bNot]) b.disabled = on; ta.disabled = on; };

    function conclude(verdict, feedback) {
      const r = update((s) => waterPlot(s, plotId, verdict));
      const tail = !r.ok ? '' : verdict === 'solid' ? (r.grew ? ' It grew a stage.' : r.revived ? ' It revived.' : ' It is watered.') : verdict === 'partial' ? ' It is watered but did not grow.' : ' It is not watered; the concept stays on your revisit list.';
      row.replaceChildren(closeBtn('Done'));
      ta.disabled = true;
      log.textContent = `${feedback}${tail}`;
      onDone?.(`${plot.concept}: ${verdict}.${tail}`);
    }

    async function hint() {
      const i = Math.min(hints, 1);
      hints += 1;
      lock(true);
      try {
        log.textContent = claude ? (await tutor.hint(2, { kind: 'open', text: question }, i, ctx)) : retrievalHint(plot, sub, i);
      } catch (e) { log.textContent = describeError(e).message; }
      lock(false);
    }

    async function ask() {
      const q = ta.value.trim();
      if (q.length < MIN_QUESTION_CHARS) { log.textContent = 'Type your question in the box first, then press Ask. It will not count as your answer.'; return; }
      lock(true);
      log.textContent = 'Asking...';
      try {
        const a = await tutor?.answerQuestion?.(q, ctx);
        log.textContent = a ? `${a.external ? '(External, not from your notes) ' : ''}${a.text}` : 'No tutor is available to ask just now.';
        ta.value = '';
      } catch (e) { log.textContent = describeError(e).message; }
      lock(false);
    }

    async function notSure() {
      lock(true);
      let teach = '';
      try {
        if (claude && tutor.notSure) teach = ` ${(await tutor.notSure(2, { kind: 'open', text: question }, ctx)).explanation ?? ''}`;
      } catch { /* the gap is logged either way */ }
      conclude('missing', `Noted, that is useful to know.${teach || ` Re-read "${sub?.title ?? 'the building'}" in your notes.`}`);
    }

    async function submit() {
      const text = ta.value.trim();
      if (text.length < MIN_ANSWER_CHARS) { log.textContent = `Write a sentence or two (at least ${MIN_ANSWER_CHARS} characters). That was not counted.`; return; }
      lock(true);
      log.textContent = 'Checking...';
      try {
        let ev;
        if (claude) ev = await tutor.retrieve(ctx, { concept: plot.concept, question, answer: text });
        else {
          ev = plan.item ? evaluateRetrievalItem(text, plan.item, plot) : evaluateRetrievalOffline(text, plot, sub);
          if (ev.rejected) { log.textContent = ev.feedback; lock(false); return; }
          ev.feedback = `OFFLINE CHECK. ${ev.feedback}`;
        }
        conclude(ev.verdict, ev.feedback);
      } catch (e) {
        log.textContent = describeError(e).message;
        lock(false);
      }
    }
  }
}
