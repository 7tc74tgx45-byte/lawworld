// Provider-agnostic encounter state machine (VISION §1). Pure JS: no DOM, no Phaser.
//
// Tutor interface (all methods may be sync or async):
//   tutor.name                                   display name
//   tutor.generate(stage, ctx)    -> { text, options? }   (stage 1 = intro, 2-5 open, 6 = one MCQ per call)
//   tutor.evaluate(stage, prompt, answer, ctx)
//        -> { verdict:'solid'|'partial'|'missing', feedback, conceptsHit, conceptsMissed,
//             followUp?, correct? (MCQ), iracScore? }
//   tutor.hint(stage, prompt, index, ctx)   -> string   (a nudge, never the answer)
//   tutor.notSure(stage, prompt, ctx)       -> { explanation, concepts[] }   (optional)
//   tutor.answerQuestion(question, ctx)     -> { text, external? }
//
// Every engine method resolves to { ok, messages[], prompt, done, stage, rejected? }.

// Constants and pure rules (STAGES, computeOutcome, normaliseEvaluation, leaksAnswer) live in encounterRules.js.
import {
  STAGES, MIN_EXCHANGES, MIN_ANSWER_CHARS, MIN_QUESTION_CHARS, MAX_FOLLOWUPS, MAX_HINTS, CHECKPOINT_QUESTIONS, REFLECTIONS,
  computeOutcome, normaliseEvaluation, leaksAnswer,
} from './encounterRules.js';

export {
  STAGES, MIN_EXCHANGES, MIN_ANSWER_CHARS, MAX_FOLLOWUPS, MAX_HINTS, CHECKPOINT_QUESTIONS,
  computeOutcome, normaliseEvaluation, leaksAnswer,
};

/**
 * createEncounter({ subsection, tutor, priorGaps }) -> engine.
 * priorGaps: open gap records for this subsection (shown to the tutor as context; never to the player here).
 * The legacy positional form createEncounter(subsection, tutor) is still accepted.
 */
export function createEncounter(arg, legacyTutor) {
  const opts = legacyTutor ? { subsection: arg, tutor: legacyTutor } : arg ?? {};
  const { subsection } = opts;
  let tutor = opts.tutor; // can be swapped by switchTutor() (e.g. "continue offline" after a failed Claude call)
  const priorGaps = Array.isArray(opts.priorGaps) ? opts.priorGaps.map((g) => ({ ...g })) : [];
  // Memory of earlier sessions (parsed TUTOR-SESSION notes: { date, outcome, gaps[], nextTime[] }), loaded once
  // before the intro by the injected opts.loadMemory(). A failure just means "no memory".
  let memory = Array.isArray(opts.memory) ? opts.memory.map((m) => (typeof m === 'object' ? { ...m } : m)) : null;
  async function ensureMemory() {
    if (memory || !opts.loadMemory) return; // no loader: leave memory unset so a provider may load it itself
    try {
      const m = await opts.loadMemory();
      memory = Array.isArray(m) ? m : [];
    } catch {
      memory = [];
    }
  }
  if (!subsection || !tutor) throw new Error('createEncounter needs { subsection, tutor }.');
  // Answer keys from the tutor's generate() stay here, so hints can be checked against them.
  let secret = '';
  let busy = false;
  const state = {
    stage: 1,
    current: null,
    introShown: false,
    exchanges: 0,
    stages: {},
    mcq: { index: 0, correct: 0, answered: 0, hints: 0, results: [] },
    reflections: [],
    gaps: [],
    transcript: [],
    done: false,
    left: false,
    verdictText: '',
  };
  for (const n of [2, 3, 4, 5]) {
    state.stages[n] = { answers: [], evaluations: [], followUps: 0, hints: 0, notSure: false, answered: false, verdict: null, iracScore: null };
  }

  let tutorName = tutor.name ?? 'Tutor';
  const tutorsUsed = [tutorName];
  // Set while a stage prompt is being fetched. If the fetch fails, next() picks it up again
  // so the player's answer (already evaluated and counted) is never submitted twice.
  let pendingOpen = null;

  function say(role, text, meta = {}) {
    const m = { role, text, stage: state.stage, ...meta };
    state.transcript.push(m);
    return m;
  }
  function out(messages, extra = {}) {
    return { ok: true, messages, prompt: state.current, done: state.done, stage: state.stage, ...extra };
  }
  function reject(text) {
    const m = say('system', text, { rejected: true });
    return { ok: false, rejected: true, messages: [m], prompt: state.current, done: state.done, stage: state.stage };
  }
  function ctx(extra = {}) {
    const st = state.stages[state.stage];
    return {
      subsection,
      answers: st ? [...st.answers] : [],
      followUpsUsed: st ? st.followUps : 0,
      notSure: st ? st.notSure : false,
      mcqIndex: state.mcq.index,
      priorGaps: priorGaps.map((g) => ({ ...g })),
      memory: memory ? memory.map((m) => (typeof m === 'object' ? { ...m } : m)) : undefined,
      exchanges: state.exchanges,
      ...extra,
    };
  }
  function addGaps(concepts, stage, verdict) {
    for (const c of concepts ?? []) addGap(c, stage, verdict);
  }
  function addGap(concept, stage, verdict) {
    if (!concept) return;
    if (!state.gaps.some((g) => g.concept === concept && g.stage === stage)) {
      state.gaps.push({ subsectionId: subsection.id, concept, stage, verdict });
    }
  }
  function publicPrompt(p, stage, extra = {}) {
    // Only display fields leave the engine; never any answer key from the tutor.
    const out = { stage, kind: p.options ? 'mcq' : 'open', text: p.text, ...extra };
    if (p.options) out.options = [...p.options];
    return out;
  }

  async function openPrompt(stage) {
    state.stage = stage;
    pendingOpen = stage;
    const p = await tutor.generate(stage, ctx());
    pendingOpen = null;
    secret = typeof p.modelAnswer === 'string' ? p.modelAnswer : '';
    state.current = publicPrompt(p, stage, stage === 6 ? { mcqIndex: state.mcq.index, mcqTotal: CHECKPOINT_QUESTIONS } : {});
    return [say('tutor', p.text, { kind: state.current.kind })];
  }

  async function enterVerdict() {
    state.stage = 7;
    if (state.exchanges < MIN_EXCHANGES) {
      const text = REFLECTIONS[state.reflections.length % REFLECTIONS.length];
      state.current = { stage: 7, kind: 'open', reflection: true, text };
      return [say('tutor', text, { kind: 'open' })];
    }
    const result = buildResult(true);
    const lines = [];
    lines.push(
      result.outcome === 'consolidated'
        ? 'Verdict: CONSOLIDATED. You showed the rule precisely and applied it well.'
        : 'Verdict: EXPLORED. Good work, but this one is not consolidated yet. Come back and tighten the gaps below.'
    );
    for (const n of [2, 3, 4, 5]) {
      const s = state.stages[n];
      lines.push(`${STAGES[n - 1].label}: ${s.verdict ?? 'not answered'}.`);
    }
    lines.push(`Checkpoint: ${state.mcq.correct}/${CHECKPOINT_QUESTIONS}.`);
    if (state.gaps.length) {
      lines.push('To revisit: ' + [...new Set(state.gaps.map((g) => g.concept))].join('; ') + '.');
    } else {
      lines.push('No gaps logged this time.');
    }
    state.verdictText = lines.join('\n');
    state.done = true;
    state.current = { stage: 7, kind: 'verdict', text: state.verdictText };
    return [say('tutor', state.verdictText, { kind: 'verdict' })];
  }

  async function advanceFrom(stage) {
    if (stage < 5) return openPrompt(stage + 1);
    if (stage === 5) {
      state.mcq.index = 0;
      return openPrompt(6);
    }
    return enterVerdict();
  }

  function finaliseStage(n) {
    const s = state.stages[n];
    if (s.verdict && s.verdict !== 'solid') {
      const last = s.evaluations[s.evaluations.length - 1];
      addGaps(last?.conceptsMissed, n, s.verdict);
    }
  }

  function parseMcq(answer, prompt) {
    const opts = prompt.options;
    if (typeof answer === 'number' && Number.isInteger(answer) && answer >= 0 && answer < opts.length) return answer;
    const t = String(answer ?? '').trim();
    if (/^[a-c]$/i.test(t) && t.toLowerCase().charCodeAt(0) - 97 < opts.length) return t.toLowerCase().charCodeAt(0) - 97;
    if (/^\d+$/.test(t) && +t >= 0 && +t < opts.length) return +t;
    const i = opts.findIndex((o) => o.trim().toLowerCase() === t.toLowerCase());
    return i;
  }

  async function submitMcq(answer) {
    const idx = parseMcq(answer, state.current);
    if (idx < 0) return reject('Please choose one of the options.');
    const ev = normaliseEvaluation(await tutor.evaluate(6, state.current, idx, ctx()));
    state.exchanges++;
    const picked = state.current.options[idx];
    const msgs = [say('player', picked, { kind: 'mcq' })];
    const correct = ev.correct ?? ev.verdict === 'solid';
    state.mcq.answered++;
    if (correct) state.mcq.correct++;
    else addGaps(ev.conceptsMissed, 6, 'missing');
    state.mcq.results.push({ correct, picked: idx, concepts: ev.conceptsHit ?? [] });
    msgs.push(say('tutor', ev.feedback, { kind: 'feedback', correct }));
    state.mcq.index++;
    state.mcq.hints = 0;
    if (state.mcq.index < CHECKPOINT_QUESTIONS) msgs.push(...(await openPrompt(6)));
    else msgs.push(...(await enterVerdict()));
    return out(msgs, { evaluation: ev });
  }

  async function submitReflection(answer) {
    state.exchanges++;
    state.reflections.push(answer);
    const msgs = [say('player', answer, { kind: 'open' })];
    msgs.push(say('tutor', 'Thank you. That goes into your session record.', { kind: 'feedback' }));
    msgs.push(...(await enterVerdict()));
    return out(msgs);
  }

  async function submitOpen(answer) {
    const n = state.stage;
    const s = state.stages[n];
    // Evaluate first: if the tutor call throws, nothing has been counted and the player can retry.
    const ev = normaliseEvaluation(await tutor.evaluate(n, state.current, answer, ctx({ answers: [...s.answers, answer] })));
    state.exchanges++;
    s.answers.push(answer);
    s.answered = true;
    const msgs = [say('player', answer, { kind: 'open' })];
    // A taught-then-restated answer can earn at most "partial".
    if (s.notSure && ev.verdict === 'solid') ev.verdict = 'partial';
    s.evaluations.push(ev);
    s.verdict = ev.verdict;
    if (typeof ev.iracScore === 'number') s.iracScore = ev.iracScore;
    msgs.push(say('tutor', ev.feedback, { kind: 'feedback', verdict: ev.verdict }));
    if (ev.verdict !== 'solid' && s.followUps < MAX_FOLLOWUPS) {
      s.followUps++;
      const text = ev.followUp || 'Can you say a little more? Try to tighten the part that was thin.';
      state.current = { stage: n, kind: 'open', isFollowUp: true, text };
      msgs.push(say('tutor', text, { kind: 'open', followUp: true }));
    } else {
      finaliseStage(n);
      msgs.push(...(await advanceFrom(n)));
    }
    return out(msgs, { evaluation: ev });
  }

  async function submit(answer) {
    if (state.done || !state.current || state.current.kind === 'info' || state.current.kind === 'verdict') {
      return reject('There is nothing to answer right now.');
    }
    if (state.current.kind === 'mcq') return submitMcq(answer);
    const text = String(answer ?? '').trim();
    if (text.length < MIN_ANSWER_CHARS) {
      return reject(`Give me a little more than that (at least ${MIN_ANSWER_CHARS} characters). A full sentence is fine. That one was not counted.`);
    }
    if (state.current.reflection) return submitReflection(text);
    return submitOpen(text);
  }

  /** Re-fetch the prompt of the current stage with the current tutor (used after switching tutor). */
  async function refreshPrompt() {
    if (state.done) return out([]);
    if (pendingOpen !== null) return out(await openPrompt(pendingOpen));
    const cur = state.current;
    if (!cur) return next();
    if (cur.kind === 'info') {
      const p = await tutor.generate(1, ctx());
      state.current = { stage: 1, kind: 'info', text: p.text };
      return out([say('tutor', p.text, { kind: 'info' })]);
    }
    if (cur.isFollowUp) return out([]); // a follow-up is about the player's own answer: keep it
    if (state.stage >= 2 && state.stage <= 6 && !cur.reflection) return out(await openPrompt(state.stage));
    return out([]);
  }

  async function switchTutor(newTutor) {
    if (state.done) return out([]);
    const old = { tutor, tutorName };
    tutor = newTutor;
    tutorName = tutor.name ?? 'Tutor';
    try {
      const res = await refreshPrompt();
      if (!tutorsUsed.includes(tutorName)) tutorsUsed.push(tutorName);
      return res;
    } catch (e) {
      tutor = old.tutor;
      tutorName = old.tutorName;
      throw e;
    }
  }

  async function next() {
    if (state.done) return out([]);
    if (pendingOpen !== null) return out(await openPrompt(pendingOpen));
    if (!state.current) {
      state.stage = 1;
      await ensureMemory();
      const p = await tutor.generate(1, ctx());
      state.current = { stage: 1, kind: 'info', text: p.text };
      state.introShown = true;
      return out([say('tutor', p.text, { kind: 'info' })]);
    }
    if (state.current.kind === 'info') return out(await openPrompt(2));
    return out([]);
  }

  async function hint() {
    const cur = state.current;
    if (!cur || (cur.kind !== 'open' && cur.kind !== 'mcq') || cur.reflection) {
      return out([say('system', 'No hint is needed here.', { kind: 'system' })]);
    }
    const holder = state.stage === 6 ? state.mcq : state.stages[state.stage];
    if (holder.hints >= MAX_HINTS) {
      return out([say('tutor', 'That is all the nudges I can give without handing you the answer. Have a go, or tell me you are not sure and I will teach it.', { kind: 'hint' })]);
    }
    const idx = holder.hints;
    let text = String(await tutor.hint(state.stage, cur, idx, ctx()) ?? '').trim();
    holder.hints++;
    // Safety net: a hint must nudge. If a provider echoes the model answer, replace it with a generic nudge.
    if (!text || leaksAnswer(text, secret)) {
      text = 'Think about which element or authority the question is really testing, and try to state it in your own words.';
    }
    return out([say('tutor', `Hint: ${text}`, { kind: 'hint' })]);
  }

  async function notSure() {
    const cur = state.current;
    if (!cur || (cur.kind !== 'open' && cur.kind !== 'mcq')) return out([]);
    if (cur.reflection) {
      return out([say('tutor', 'That is honest, and useful. Tell me in a sentence which part feels shakiest.', { kind: 'feedback' })]);
    }
    const n = state.stage;
    const info = tutor.notSure ? await tutor.notSure(n, cur, ctx()) : { explanation: '', concepts: subsection.keyConcepts };
    const concepts = info.concepts?.length ? info.concepts : subsection.keyConcepts;
    addGaps(concepts, n, 'missing');
    const msgs = [say('player', "I'm not sure", { kind: 'notSure' })];
    if (n === 6) {
      state.mcq.answered++;
      state.mcq.results.push({ correct: false, notSure: true });
      msgs.push(say('tutor', `No problem, and I have logged it to revisit. ${info.explanation}`, { kind: 'feedback', correct: false }));
      state.mcq.index++;
      state.mcq.hints = 0;
      if (state.mcq.index < CHECKPOINT_QUESTIONS) msgs.push(...(await openPrompt(6)));
      else msgs.push(...(await enterVerdict()));
      return out(msgs);
    }
    const s = state.stages[n];
    if (s.notSure) {
      // Already taught once in this stage: log it as missing and move on honestly.
      s.verdict = s.verdict ?? 'missing';
      msgs.push(say('tutor', 'Fine. It is logged as something to revisit, and we will come back to it.', { kind: 'feedback' }));
      msgs.push(...(await advanceFrom(n)));
      return out(msgs);
    }
    s.notSure = true;
    s.verdict = 'missing';
    msgs.push(say('tutor', `That is fine, and it is useful for me to know. I have logged it as a gap. Here is the idea:\n${info.explanation}`, { kind: 'feedback' }));
    const text = 'Now put that back in your own words, so I know it has landed.';
    state.current = { stage: n, kind: 'open', isFollowUp: true, text };
    msgs.push(say('tutor', text, { kind: 'open', followUp: true }));
    return out(msgs);
  }

  async function ask(question) {
    const q = String(question ?? '').trim();
    if (q.length < MIN_QUESTION_CHARS) return reject('Type your question first (a few words at least).');
    const msgs = [say('player', q, { kind: 'question' })];
    const a = tutor.answerQuestion
      ? await tutor.answerQuestion(q, ctx())
      : { text: 'I cannot answer questions in this mode.', external: false };
    const text = a.external ? `External, not from your notes: ${a.text}` : a.text;
    msgs.push(say('tutor', text, { kind: 'answer', external: !!a.external }));
    return out(msgs);
  }

  function buildResult(finished) {
    const stages = {};
    for (const n of [2, 3, 4, 5]) {
      const s = state.stages[n];
      const last = s.evaluations[s.evaluations.length - 1];
      stages[n] = {
        answered: s.answered, verdict: s.verdict, followUps: s.followUps, hints: s.hints, notSure: s.notSure, iracScore: s.iracScore,
        // Concepts the final evaluation of this stage credited (progress.js resolves gaps from these).
        conceptsHit: [...(last?.conceptsHit ?? [])],
      };
    }
    const checkpoint = {
      correct: state.mcq.correct, total: CHECKPOINT_QUESTIONS, answered: state.mcq.answered,
      conceptsHit: state.mcq.results.flatMap((r) => (r.correct ? r.concepts ?? [] : [])),
    };
    const outcome = finished ? computeOutcome({ stages, checkpoint }) : 'explored';
    // Leaving mid-stage (e.g. during a follow-up) must still log what the last evaluation found
    // missing or partial, otherwise thin answers would leave no gap behind.
    const gaps = state.gaps.map((g) => ({ ...g }));
    for (const n of [2, 3, 4, 5]) {
      const s = state.stages[n];
      if (!s.answered || !s.verdict || s.verdict === 'solid') continue;
      const last = s.evaluations[s.evaluations.length - 1];
      for (const c of last?.conceptsMissed ?? []) {
        if (c && !gaps.some((g) => g.concept === c && g.stage === n)) {
          gaps.push({ subsectionId: subsection.id, concept: c, stage: n, verdict: s.verdict });
        }
      }
    }
    return {
      subsectionId: subsection.id,
      tutor: tutorsUsed.length > 1 ? tutorsUsed.join(' then ') : tutorName,
      outcome,
      finished,
      stages,
      checkpoint,
      exchanges: state.exchanges,
      gaps,
      reflections: [...state.reflections],
      verdictText: state.verdictText,
      transcript: state.transcript.map((m) => ({ ...m })),
    };
  }

  function result() {
    return buildResult(state.done);
  }

  function leave() {
    state.left = true;
    return buildResult(state.done);
  }

  // Serialise async calls: a double-click must not count one answer twice or skip a stage.
  const guarded = (fn) => async (...args) => {
    if (state.left) return reject('You have left this encounter.');
    if (busy) return reject('One moment: the tutor is still thinking.');
    busy = true;
    const mark = state.transcript.length;
    try {
      return await fn(...args);
    } catch (e) {
      // Whatever was said before the failure (the player's answer, the feedback) still belongs on
      // screen; the UI reads it from e.messages and offers retry.
      if (e && typeof e === 'object') e.messages = state.transcript.slice(mark).map((m) => ({ ...m }));
      throw e;
    } finally {
      busy = false;
    }
  };

  return {
    next: guarded(next),
    submit: guarded(submit),
    hint: guarded(hint),
    notSure: guarded(notSure),
    ask: guarded(ask),
    switchTutor: guarded(switchTutor),
    /** True when a failed call left a stage prompt unfetched: retry with next(), never submit() again. */
    hasPending: () => pendingOpen !== null,
    leave,
    result,
    status: () => ({ stage: state.stage, exchanges: state.exchanges, done: state.done, left: state.left, tutorName, prompt: state.current }),
  };
}
