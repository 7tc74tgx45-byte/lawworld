// Client mode of the encounter engine (T12): scenario -> advice -> evaluation -> ONE follow-up -> verdict.
// Pure JS. The tutor is injected and must provide:
//   tutor.clientScenario(ctx)            -> { text, modelAnswer? }       (the client's problem, built from the subsection)
//   tutor.evaluate(5, prompt, answer, ctx) -> { verdict, feedback, conceptsHit, conceptsMissed, followUp?, iracScore? }
//   tutor.hint(5, prompt, index, ctx)    -> string                         (optional)
// Rules shared with the main engine (VISION §1): typed advice only (>= 15 chars), no skip, "I'm not sure" logs a gap
// and can earn at most "partial", hints nudge and never leak the model answer, the player can leave at any time.
// The reward is NOT decided here: src/logic/clients.js recomputes it from result().evaluations.

import { MIN_ANSWER_CHARS, MAX_HINTS, normaliseEvaluation, leaksAnswer } from './encounterRules.js';

export const CLIENT_MAX_FOLLOWUPS = 1;

export function createClientEncounter({ subsection, tutor, clientName = 'The client', priorGaps = [] }) {
  if (!subsection || !tutor) throw new Error('createClientEncounter needs { subsection, tutor }.');
  const st = { current: null, answers: [], evaluations: [], followUps: 0, hints: 0, notSure: false, done: false, left: false, busy: false, secret: '' };
  const transcript = [];
  const say = (role, text, meta = {}) => {
    const m = { role, text, ...meta };
    transcript.push(m);
    return m;
  };
  const ctx = (extra = {}) => ({ subsection, clientName, priorGaps: priorGaps.map((g) => ({ ...g })), answers: [...st.answers], followUpsUsed: st.followUps, notSure: st.notSure, mode: 'client', ...extra });
  const out = (messages, extra = {}) => ({ ok: true, messages, prompt: st.current, done: st.done, ...extra });
  const reject = (text) => ({ ok: false, rejected: true, messages: [say('system', text, { rejected: true })], prompt: st.current, done: st.done });
  const guard = (fn) => async (...a) => {
    if (st.left) return reject('You have left this case.');
    if (st.busy) return reject('One moment: the tutor is still thinking.');
    st.busy = true;
    try {
      return await fn(...a);
    } finally {
      st.busy = false;
    }
  };

  async function start() {
    if (st.current) return out([]);
    const p = await tutor.clientScenario(ctx());
    st.secret = typeof p.modelAnswer === 'string' ? p.modelAnswer : '';
    st.current = { kind: 'open', text: p.text };
    return out([say('client', p.text, { kind: 'scenario' })]);
  }

  async function submit(answer) {
    if (st.done || !st.current) return reject('There is nothing to answer right now.');
    const text = String(answer ?? '').trim();
    if (text.length < MIN_ANSWER_CHARS) return reject(`Advise the client in a full sentence or two (at least ${MIN_ANSWER_CHARS} characters). That was not counted.`);
    const ev = normaliseEvaluation(await tutor.evaluate(5, st.current, text, ctx({ answers: [...st.answers, text] })));
    st.answers.push(text);
    if (st.notSure && ev.verdict === 'solid') ev.verdict = 'partial';
    st.evaluations.push(ev);
    const msgs = [say('player', text, { kind: 'open' }), say('tutor', ev.feedback, { kind: 'feedback', verdict: ev.verdict })];
    if (ev.verdict !== 'solid' && st.followUps < CLIENT_MAX_FOLLOWUPS) {
      st.followUps++;
      const f = ev.followUp || 'Can you tighten that? State the issue, the rule, how it applies to these facts, and your conclusion.';
      st.current = { kind: 'open', isFollowUp: true, text: f };
      msgs.push(say('client', f, { kind: 'followUp' }));
    } else {
      st.done = true;
      st.current = { kind: 'verdict' };
    }
    return out(msgs, { evaluation: ev });
  }

  async function notSure() {
    if (st.done || !st.current) return out([]);
    st.notSure = true;
    const info = tutor.notSure ? await tutor.notSure(5, st.current, ctx()) : { explanation: '', concepts: subsection.keyConcepts ?? [] };
    const concepts = info.concepts?.length ? info.concepts : subsection.keyConcepts ?? [];
    // An "I'm not sure" with no answer yet is logged as a missing evaluation so the gap is recorded.
    st.evaluations.push({ verdict: 'missing', feedback: '', conceptsHit: [], conceptsMissed: [...concepts], notSure: true });
    const msgs = [say('player', "I'm not sure", { kind: 'notSure' }), say('tutor', `That is honest, and useful. I have logged it to revisit. ${info.explanation ?? ''}`.trim(), { kind: 'feedback' })];
    if (st.followUps < CLIENT_MAX_FOLLOWUPS) {
      st.followUps++;
      st.current = { kind: 'open', isFollowUp: true, text: 'Now put it to the client in your own words, so I know it has landed.' };
      msgs.push(say('client', st.current.text, { kind: 'followUp' }));
    } else {
      st.done = true;
      st.current = { kind: 'verdict' };
    }
    return out(msgs);
  }

  async function hint() {
    if (st.done || !st.current) return out([say('system', 'No hint is needed here.')]);
    if (st.hints >= MAX_HINTS) return out([say('tutor', 'That is all the nudges I can give without handing you the answer. Have a go, or say you are not sure.', { kind: 'hint' })]);
    let t = String((await tutor.hint?.(5, st.current, st.hints, ctx())) ?? '').trim();
    st.hints++;
    if (!t || leaksAnswer(t, st.secret)) t = 'Start with the Issue: what exactly does the client need to know? Then find the rule that answers it.';
    return out([say('tutor', `Hint: ${t}`, { kind: 'hint' })]);
  }

  function result() {
    return {
      subsectionId: subsection.id,
      mode: 'client',
      evaluations: st.evaluations.map((e) => ({ ...e })),
      notSure: st.notSure,
      finished: st.done,
      answers: [...st.answers],
      transcript: transcript.map((m) => ({ ...m })),
    };
  }

  return {
    start: guard(start), submit: guard(submit), notSure: guard(notSure), hint: guard(hint),
    leave: () => { st.left = true; return result(); },
    result,
  };
}
