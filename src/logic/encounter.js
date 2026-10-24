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

export const STAGES = [
  { n: 1, key: 'intro', label: 'Intro' },
  { n: 2, key: 'plain', label: 'Plain English' },
  { n: 3, key: 'precision', label: 'Precision' },
  { n: 4, key: 'authority', label: 'Authority' },
  { n: 5, key: 'application', label: 'Application' },
  { n: 6, key: 'checkpoint', label: 'Checkpoint' },
  { n: 7, key: 'verdict', label: 'Verdict' },
];

export const MIN_EXCHANGES = 8;
export const MIN_ANSWER_CHARS = 15;
export const MAX_FOLLOWUPS = 2;
export const MAX_HINTS = 2;
export const CHECKPOINT_QUESTIONS = 3;

const REFLECTIONS = [
  'Before I give the verdict: in a sentence or two, which part of this topic do you feel least sure about, and why?',
  'One more thing for the record: pick one case from this session and tell me, in your own words, what it decided.',
  'Last check: what is the single idea from this session you would most want to remember in an exam or with a client?',
];

const RANK = { missing: 0, partial: 1, solid: 2 };

/** Consolidation rule, exactly VISION §1. */
export function computeOutcome({ stages, checkpoint }) {
  for (const n of [2, 3, 4, 5]) {
    const s = stages[n];
    if (!s || !s.answered || !s.verdict) return 'explored';
    if (RANK[s.verdict] < RANK.partial) return 'explored';
  }
  if (stages[3].verdict !== 'solid' || stages[5].verdict !== 'solid') return 'explored';
  if (checkpoint.correct < 2) return 'explored';
  return 'consolidated';
}

export function createEncounter(subsection, tutor) {
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

  const tutorName = tutor.name ?? 'Tutor';

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
      ...extra,
    };
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
    const p = await tutor.generate(stage, ctx());
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
      for (const c of last?.conceptsMissed ?? []) addGap(c, n, s.verdict);
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
    state.exchanges++;
    const picked = state.current.options[idx];
    const msgs = [say('player', picked, { kind: 'mcq' })];
    const ev = await tutor.evaluate(6, state.current, idx, ctx());
    const correct = ev.correct ?? ev.verdict === 'solid';
    state.mcq.answered++;
    if (correct) state.mcq.correct++;
    else for (const c of ev.conceptsMissed ?? []) addGap(c, 6, 'missing');
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
    state.exchanges++;
    s.answers.push(answer);
    s.answered = true;
    const msgs = [say('player', answer, { kind: 'open' })];
    const ev = await tutor.evaluate(n, state.current, answer, ctx());
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

  async function next() {
    if (state.done) return out([]);
    if (!state.current) {
      state.stage = 1;
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
    const idx = holder.hints++;
    const text = await tutor.hint(state.stage, cur, idx, ctx());
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
    for (const c of concepts) addGap(c, n, 'missing');
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
    if (q.length < 5) return reject('Type your question first (a few words at least).');
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
      tutor: tutorName,
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

  return {
    next,
    submit,
    hint,
    notSure,
    ask,
    leave,
    result,
    status: () => ({ stage: state.stage, exchanges: state.exchanges, done: state.done, left: state.left, tutorName }),
  };
}
