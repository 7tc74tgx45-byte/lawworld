// Engine tests with a mock tutor, independent of the offline bank.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEncounter, leaksAnswer, MIN_EXCHANGES } from '../src/logic/encounter.js';

const SUB = { id: 'mock-sub', title: 'Mock', module: 'Mock', keyConcepts: ['alpha', 'beta'] };
const SECRET = 'the secret model answer says alpha beta gamma delta epsilon zeta eta theta iota';
const LONG = 'This is a perfectly long enough typed answer.';

/** verdicts: stage -> verdict string, or array consumed one per call (last one repeats). */
function mockTutor(verdicts = {}, opts = {}) {
  const calls = { evaluate: [], generate: [], hint: [], ask: [] };
  const queue = {};
  for (const [k, v] of Object.entries(verdicts)) if (Array.isArray(v)) queue[k] = [...v];
  const verdictFor = (stage) => {
    const v = verdicts[stage] ?? 'solid';
    if (Array.isArray(v)) return queue[stage].length > 1 ? queue[stage].shift() : queue[stage][0];
    return v;
  };
  return {
    name: 'Mock Tutor',
    calls,
    generate(stage, ctx) {
      calls.generate.push({ stage, ctx });
      if (stage === 6) return { text: `Q${ctx.mcqIndex + 1}`, options: ['A1', 'A2', 'A3'], correct: 1, modelAnswer: 'A2 because of the secret' };
      return { text: `Prompt ${stage}`, modelAnswer: SECRET };
    },
    evaluate(stage, prompt, answer, ctx) {
      calls.evaluate.push({ stage, answer, ctx });
      if (stage === 6) {
        const correct = answer === (opts.mcqCorrect?.[ctx.mcqIndex] ?? 1);
        return { verdict: correct ? 'solid' : 'missing', correct, feedback: correct ? 'Right.' : 'Wrong.', conceptsHit: correct ? ['mcq-ok'] : [], conceptsMissed: correct ? [] : [`mcq-${ctx.mcqIndex}`] };
      }
      const verdict = verdictFor(stage);
      return {
        verdict,
        feedback: `fb-${verdict}`,
        conceptsHit: verdict === 'missing' ? [] : ['alpha'],
        conceptsMissed: verdict === 'solid' ? [] : [`gap-${stage}`],
        followUp: 'Tell me more about that.',
        iracScore: stage === 5 ? 3 : undefined,
      };
    },
    hint(stage, prompt, index) {
      calls.hint.push({ stage, index });
      return opts.leakyHint ? SECRET : `nudge ${index + 1} for stage ${stage}`;
    },
    answerQuestion(q) {
      calls.ask.push(q);
      return { text: 'Answer to your question.', external: !!opts.external };
    },
  };
}

async function start(tutor, extra = {}) {
  const enc = createEncounter({ subsection: SUB, tutor, ...extra });
  await enc.next();
  await enc.next();
  return enc;
}

async function finish(enc, picks = [1, 1, 1]) {
  let r;
  for (const p of picks) r = await enc.submit(p);
  let guard = 0;
  while (!r.done && guard++ < 4) r = await enc.submit('A reflective answer about what felt shaky.');
  return r;
}

test('options-object signature works and the legacy positional form still does', async () => {
  const a = createEncounter({ subsection: SUB, tutor: mockTutor(), priorGaps: [] });
  assert.equal((await a.next()).prompt.kind, 'info');
  const b = createEncounter(SUB, mockTutor());
  assert.equal((await b.next()).prompt.kind, 'info');
  assert.throws(() => createEncounter({ subsection: SUB }));
});

test('next() returns the current prompt and does not advance past an unanswered question', async () => {
  const enc = await start(mockTutor());
  const r1 = await enc.next();
  const r2 = await enc.next();
  assert.equal(r1.prompt.text, 'Prompt 2');
  assert.equal(r2.prompt.text, 'Prompt 2');
  assert.equal(enc.status().stage, 2);
});

test('priorGaps reach the tutor context', async () => {
  const t = mockTutor();
  const gaps = [{ subsectionId: SUB.id, concept: 'alpha', stage: 3 }];
  const enc = await start(t, { priorGaps: gaps });
  assert.deepEqual(t.calls.generate[0].ctx.priorGaps, gaps);
  await enc.submit(LONG);
  assert.equal(t.calls.evaluate[0].ctx.priorGaps[0].concept, 'alpha');
});

test('no verdict can be reached without answering: result is never consolidated', async () => {
  const enc = await start(mockTutor());
  for (let i = 0; i < 5; i++) await enc.next();
  assert.equal(enc.result().finished, false);
  assert.equal(enc.result().outcome, 'explored');
  assert.equal(enc.status().done, false);
  await enc.hint();
  await enc.ask('What does this mean here?');
  assert.equal(enc.status().stage, 2);
  assert.equal(enc.status().done, false);
  const r = await enc.submit('short');
  assert.equal(r.ok, false);
  assert.equal(enc.status().done, false);
});

test('answers under 15 characters are rejected gently, not counted, not evaluated', async () => {
  const t = mockTutor();
  const enc = await start(t);
  const r = await enc.submit('  too short  ');
  assert.equal(r.ok, false);
  assert.equal(r.rejected, true);
  assert.match(r.messages[0].text, /not counted/);
  assert.equal(enc.status().exchanges, 0);
  assert.equal(t.calls.evaluate.length, 0);
  const ok = await enc.submit('x'.repeat(15));
  assert.equal(ok.ok, true);
  assert.equal(enc.status().exchanges, 1);
});

test('MCQ answers must be one of the options', async () => {
  const enc = await start(mockTutor());
  for (let n = 2; n <= 5; n++) await enc.submit(LONG);
  assert.equal(enc.status().stage, 6);
  for (const bad of [7, -1, 'nonsense', 1.5, null, undefined, 'D']) {
    const r = await enc.submit(bad);
    assert.equal(r.ok, false, `rejected ${String(bad)}`);
  }
  assert.equal(enc.result().checkpoint.answered, 0);
  assert.equal(enc.status().exchanges, 4);
  const good = await enc.submit('A2');
  assert.equal(good.ok, true);
  assert.equal(enc.result().checkpoint.answered, 1);
});

test('hints are no exchange, capped at 2 per stage, and never carry the model answer', async () => {
  const t = mockTutor();
  const enc = await start(t);
  const h1 = await enc.hint();
  const h2 = await enc.hint();
  const h3 = await enc.hint();
  assert.match(h1.messages[0].text, /^Hint: nudge 1/);
  assert.match(h2.messages[0].text, /^Hint: nudge 2/);
  assert.match(h3.messages[0].text, /nudges/);
  assert.equal(t.calls.hint.length, 2);
  assert.equal(enc.status().exchanges, 0);
  for (const r of [h1, h2, h3]) assert.ok(!leaksAnswer(r.messages[0].text, SECRET));
});

test('a provider hint that echoes the model answer is replaced by a generic nudge', async () => {
  const enc = await start(mockTutor({}, { leakyHint: true }));
  const r = await enc.hint();
  assert.ok(!leaksAnswer(r.messages[0].text, SECRET));
  assert.ok(!r.messages[0].text.includes('gamma delta'));
});

test('engine prompts and results never expose the tutor answer key', async () => {
  const enc = await start(mockTutor());
  const r = await enc.submit(LONG);
  const blob = JSON.stringify([r, enc.result()]);
  assert.ok(!blob.includes('secret model answer'));
  assert.equal(r.prompt.modelAnswer, undefined);
  assert.equal(r.prompt.correct, undefined);
});

test('thin answers: at most two follow-ups per stage, then move on and log the gap', async () => {
  const enc = await start(mockTutor({ 2: 'partial' }));
  let r = await enc.submit(LONG);
  assert.equal(r.prompt.isFollowUp, true);
  assert.equal(r.prompt.text, 'Tell me more about that.');
  r = await enc.submit(LONG);
  assert.equal(r.prompt.isFollowUp, true);
  r = await enc.submit(LONG);
  assert.equal(r.prompt.isFollowUp, undefined);
  assert.equal(r.stage, 3);
  const res = enc.result();
  assert.equal(res.stages[2].followUps, 2);
  assert.equal(res.stages[2].verdict, 'partial');
  assert.ok(res.gaps.some((g) => g.concept === 'gap-2' && g.stage === 2));
});

test('a follow-up that lands solid ends the stage solid with no gap', async () => {
  const enc = await start(mockTutor({ 3: ['partial', 'solid'] }));
  await enc.submit(LONG); // stage 2
  let r = await enc.submit(LONG); // stage 3 partial -> follow-up
  assert.equal(r.stage, 3);
  assert.equal(r.prompt.isFollowUp, true);
  r = await enc.submit(LONG);
  assert.equal(r.stage, 4);
  assert.equal(enc.result().stages[3].verdict, 'solid');
  assert.ok(!enc.result().gaps.some((g) => g.stage === 3));
});

test('consolidated: stages 3 and 5 solid, others at least partial, checkpoint 2/3', async () => {
  const enc = await start(mockTutor({ 2: 'partial', 4: 'partial' }));
  for (let i = 0; i < 3; i++) await enc.submit(LONG); // stage 2 (2 follow-ups)
  await enc.submit(LONG); // stage 3 solid
  for (let i = 0; i < 3; i++) await enc.submit(LONG); // stage 4
  await enc.submit(LONG); // stage 5 solid
  const r = await finish(enc, [1, 1, 0]); // 2/3
  assert.equal(r.done, true);
  const res = enc.result();
  assert.equal(res.checkpoint.correct, 2);
  assert.equal(res.outcome, 'consolidated');
  assert.match(res.verdictText, /CONSOLIDATED/);
  assert.ok(res.exchanges >= MIN_EXCHANGES);
  assert.equal(res.stages[5].iracScore, 3);
});

test('explored when stage 3 or stage 5 is only partial', async () => {
  for (const weak of [3, 5]) {
    const enc = await start(mockTutor({ [weak]: 'partial' }));
    for (let n = 2; n <= 5; n++) {
      for (let i = 0; i < (n === weak ? 3 : 1); i++) await enc.submit(LONG);
    }
    await finish(enc, [1, 1, 1]);
    const res = enc.result();
    assert.equal(res.outcome, 'explored', `stage ${weak} partial`);
    assert.ok(res.gaps.some((g) => g.stage === weak));
  }
});

test('explored when any of stages 2-5 is missing, even if the rest is solid', async () => {
  const enc = await start(mockTutor({ 4: 'missing' }));
  for (let n = 2; n <= 5; n++) for (let i = 0; i < (n === 4 ? 3 : 1); i++) await enc.submit(LONG);
  await finish(enc, [1, 1, 1]);
  const res = enc.result();
  assert.equal(res.stages[4].verdict, 'missing');
  assert.equal(res.outcome, 'explored');
});

test('explored when the checkpoint is 1/3, with MCQ gaps logged', async () => {
  const enc = await start(mockTutor());
  for (let n = 2; n <= 5; n++) await enc.submit(LONG);
  await finish(enc, [1, 0, 2]);
  const res = enc.result();
  assert.equal(res.checkpoint.correct, 1);
  assert.equal(res.outcome, 'explored');
  assert.deepEqual(res.gaps.filter((g) => g.stage === 6).map((g) => g.concept).sort(), ['mcq-1', 'mcq-2']);
});

test('minimum 8 exchanges: a clean run of 7 is held back for a reflection', async () => {
  const enc = await start(mockTutor());
  for (let n = 2; n <= 5; n++) await enc.submit(LONG);
  for (let i = 0; i < 3; i++) await enc.submit(1);
  assert.equal(enc.status().exchanges, 7);
  assert.equal(enc.status().done, false);
  assert.equal(enc.status().stage, 7);
  assert.equal((await enc.submit('meh')).ok, false);
  const r = await enc.submit('The hardest part was applying the rule to the facts.');
  assert.equal(r.done, true);
  assert.equal(enc.result().exchanges, 8);
  assert.equal(enc.result().outcome, 'consolidated');
});

test('follow-ups count toward the minimum, so no reflection is needed', async () => {
  const enc = await start(mockTutor({ 2: 'partial' }));
  for (let i = 0; i < 3; i++) await enc.submit(LONG);
  for (let n = 3; n <= 5; n++) await enc.submit(LONG);
  await enc.submit(1);
  await enc.submit(1);
  const last = await enc.submit(1);
  assert.equal(last.done, true);
  assert.equal(enc.result().exchanges, 9);
});

test('"I\'m not sure" logs gaps, teaches, and caps the stage at partial', async () => {
  const enc = await start(mockTutor());
  const r = await enc.notSure();
  assert.equal(r.prompt.isFollowUp, true);
  assert.ok(enc.result().gaps.length > 0);
  assert.equal(enc.result().stages[2].verdict, 'missing');
  assert.equal(enc.status().exchanges, 0);
  await enc.submit(LONG); // restated; mock says solid but it was taught first
  assert.equal(enc.result().stages[2].verdict, 'partial');
});

test('"I\'m not sure" on an MCQ counts as wrong and moves on', async () => {
  const enc = await start(mockTutor());
  for (let n = 2; n <= 5; n++) await enc.submit(LONG);
  const r = await enc.notSure();
  assert.equal(r.prompt.mcqIndex, 1);
  assert.equal(enc.result().checkpoint.answered, 1);
  assert.equal(enc.result().checkpoint.correct, 0);
});

test('ask() answers without counting an exchange; external answers are labelled', async () => {
  const enc = await start(mockTutor({}, { external: true }));
  const r = await enc.ask('What is the history of this rule?');
  assert.match(r.messages[1].text, /^External, not from your notes:/);
  assert.equal(r.messages[1].external, true);
  assert.equal(enc.status().exchanges, 0);
  assert.equal(enc.status().stage, 2);
  assert.equal((await enc.ask('hi')).ok, false);
  const note = await start(mockTutor());
  const r2 = await note.ask('What is the history of this rule?');
  assert.ok(!/External/.test(r2.messages[1].text));
});

test('leave() at any point is explored, keeps answers, and blocks further play', async () => {
  const enc = await start(mockTutor());
  await enc.submit(LONG);
  await enc.submit(LONG);
  const res = enc.leave();
  assert.equal(res.outcome, 'explored');
  assert.equal(res.finished, false);
  assert.equal(res.exchanges, 2);
  assert.equal(res.stages[2].answered, true);
  assert.equal(res.stages[3].answered, true);
  assert.equal(res.stages[4].answered, false);
  const after = await enc.submit(LONG);
  assert.equal(after.ok, false);
  assert.equal(enc.result().exchanges, 2);
});

test('leaving during a follow-up still logs the gap from the thin answer', async () => {
  const enc = await start(mockTutor({ 2: 'partial' }));
  await enc.submit(LONG);
  const res = enc.leave();
  assert.ok(res.gaps.some((g) => g.concept === 'gap-2'));
});

test('a finished encounter cannot be answered again', async () => {
  const enc = await start(mockTutor());
  for (let n = 2; n <= 5; n++) await enc.submit(LONG);
  await finish(enc);
  const r = await enc.submit(LONG);
  assert.equal(r.ok, false);
});

test('concurrent submits are serialised: a double-click counts once', async () => {
  const slow = mockTutor();
  const inner = slow.evaluate.bind(slow);
  slow.evaluate = async (...a) => {
    await new Promise((r) => setTimeout(r, 10));
    return inner(...a);
  };
  const enc = await start(slow);
  const [a, b] = await Promise.all([enc.submit(LONG), enc.submit(LONG)]);
  assert.equal(a.ok, true);
  assert.equal(b.ok, false);
  assert.equal(enc.status().exchanges, 1);
  assert.equal(enc.status().stage, 3);
});

test('a tutor that throws leaves the exchange uncounted so the player can retry', async () => {
  const t = mockTutor();
  const inner = t.evaluate.bind(t);
  let boom = true;
  t.evaluate = (...a) => {
    if (boom) {
      boom = false;
      throw new Error('network down');
    }
    return inner(...a);
  };
  const enc = await start(t);
  await assert.rejects(() => enc.submit(LONG), /network down/);
  assert.equal(enc.status().exchanges, 0);
  const r = await enc.submit(LONG);
  assert.equal(r.ok, true);
  assert.equal(enc.status().exchanges, 1);
});

test('malformed evaluations are normalised to partial rather than crashing or passing', async () => {
  const t = mockTutor();
  t.evaluate = () => ({ feedback: 'hmm', verdict: 'excellent!' });
  const enc = await start(t);
  const r = await enc.submit(LONG);
  assert.equal(r.evaluation.verdict, 'partial');
  assert.equal(r.prompt.isFollowUp, true);
});

test('leaksAnswer detects long verbatim runs only', () => {
  assert.equal(leaksAnswer('hello world', SECRET), false);
  assert.equal(leaksAnswer(`Hint: ${SECRET}`, SECRET), true);
  assert.equal(leaksAnswer('anything', 'short'), false);
});
