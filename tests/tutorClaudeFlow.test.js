import test from 'node:test';
import assert from 'node:assert/strict';
import { createClaudeTutor, sessionDigest } from '../src/api/tutor.js';
import { createEncounter } from '../src/logic/encounter.js';

const SUB = { id: 's1', title: 'Assault', module: 'Tort Law', sourceFile: 'N.md', heading: 'ASSAULT', keyConcepts: ['apprehension'], keyCases: [], statutes: [] };
const NOTE = '# T\n## ASSAULT\nAssault is X.\n## BATTERY\nNo.';

const mcqJson = JSON.stringify({
  questions: [0, 1, 2].map((i) => ({ text: `Q${i}?`, options: ['a', 'b', 'c'], correct: i, explanation: `Because ${i}.`, concept: `c${i}` })),
});

/** A scripted Claude: replies are chosen by what the prompt asks for, and every request is recorded. */
function scripted(extra = {}) {
  const calls = [];
  const call = async (req) => {
    calls.push(req);
    const u = req.messages[req.messages.length - 1].content;
    if (extra.override) { const r = extra.override(u, req); if (r != null) return { text: r }; }
    if (/Write the INTRO/.test(u)) return { text: '{"text":"Welcome."}' };
    if (/Write 3 multiple-choice/.test(u)) return { text: mcqJson };
    if (/Evaluate the LATEST/.test(u)) return { text: '{"verdict":"partial","feedback":"Right direction.","conceptsHit":["apprehension"],"conceptsMissed":["immediacy"],"followUp":"What about timing?"}' };
    if (/Give hint number/.test(u)) return { text: '{"text":"Think about timing."}' };
    if (/said "I'm not sure"/.test(u)) return { text: '{"explanation":"Assault is apprehension.","concepts":["apprehension"]}' };
    if (/MULTIPLE-CHOICE QUESTION/.test(u)) return { text: '{"text":"Which option is about expectation?"}' };
    if (/STUDENT QUESTION/.test(u)) return { text: '{"inNote":true,"text":"Assault is X."}' };
    return { text: '{"text":"Explain assault.","modelAnswer":"Apprehension of immediate force."}' };
  };
  const tutor = createClaudeTutor({ personaId: 'hale', call, readNote: async () => NOTE, listFiles: async () => [], ...extra.opts });
  return { tutor, calls };
}

test('Claude tutor: evaluate, hint and notSure send the note and the model answer privately, and return clean objects', async () => {
  const { tutor, calls } = scripted();
  const ctx = { subsection: SUB, priorGaps: [], answers: ['They fear being hit.'], followUpsUsed: 0 };
  const p = await tutor.generate(2, ctx);
  const ev = await tutor.evaluate(2, p, 'They fear being hit.', ctx);
  assert.equal(ev.verdict, 'partial');
  assert.equal(ev.followUp, 'What about timing?');
  const evalCall = calls.find((c) => /Evaluate the LATEST/.test(c.messages[0].content));
  assert.match(evalCall.messages[0].content, /Assault is X\./);
  assert.match(evalCall.messages[0].content, /They fear being hit\./);
  assert.equal(evalCall.tools, undefined);
  assert.equal(await tutor.hint(2, p, 0, ctx), 'Think about timing.');
  const ns = await tutor.notSure(2, p, ctx);
  assert.match(ns.explanation, /apprehension/);
  assert.deepEqual(ns.concepts, ['apprehension']);
});

test('Claude tutor: checkpoint questions are generated once, scored locally, and never mark a wrong option correct', async () => {
  const { tutor, calls } = scripted();
  const ctx = { subsection: SUB, priorGaps: [], mcqIndex: 0 };
  const q0 = await tutor.generate(6, ctx);
  assert.match(q0.text, /Question 1 of 3/);
  assert.deepEqual(q0.options, ['a', 'b', 'c']);
  const q1 = await tutor.generate(6, { ...ctx, mcqIndex: 1 });
  assert.match(q1.text, /Question 2 of 3/);
  assert.equal(calls.filter((c) => /Write 3 multiple-choice/.test(c.messages[0].content)).length, 1);
  assert.equal((await tutor.evaluate(6, q0, 0, ctx)).correct, true);
  const wrong = await tutor.evaluate(6, q0, 2, ctx);
  assert.equal(wrong.correct, false);
  assert.equal(wrong.verdict, 'missing');
  assert.deepEqual(wrong.conceptsMissed, ['c0']);
  assert.match(wrong.feedback, /Because 0/);
  assert.equal(await tutor.hint(6, q0, 0, ctx), 'Which option is about expectation?');
});

test('Claude tutor: a note-covered question never uses web search; a silent note falls back honestly if search fails', async () => {
  const a = scripted();
  const r = await a.tutor.answerQuestion('What is assault?', { subsection: SUB });
  assert.equal(r.external, false);
  assert.ok(a.calls.every((c) => !c.tools));

  const b = scripted({
    override: (u, req) => {
      if (/STUDENT QUESTION/.test(u)) return '{"inNote":false,"text":"The note covers assault only."}';
      if (req.tools) throw new Error('search down');
      return null;
    },
  });
  const r2 = await b.tutor.answerQuestion('What about nuisance?', { subsection: SUB });
  assert.equal(r2.external, false);
  assert.match(r2.text, /will not guess/);
});

test('Claude tutor: a missing heading supplies the whole note and says so in the prompt', async () => {
  const { tutor, calls } = scripted();
  await tutor.generate(1, { subsection: { ...SUB, heading: 'NO SUCH HEADING' }, priorGaps: [] });
  assert.match(calls[0].messages[0].content, /was not found, so the whole note is supplied/);
});

test('Claude tutor: prior TUTOR-SESSION digests and open gaps reach the prompt; resolved gaps do not', async () => {
  const { tutor, calls } = scripted({
    opts: {
      listFiles: async () => ['TUTOR-SESSION-2026-01-01-0900-s1.md', 'TUTOR-SESSION-2026-01-01-0900-other.md'],
      readNote: async (f) => (f.startsWith('TUTOR-SESSION-') ? '## Gaps\n- immediacy\n## Next time\nRevisit words and threats.\n' : NOTE),
    },
  });
  await tutor.generate(1, { subsection: SUB, priorGaps: [{ concept: 'open-one' }, { concept: 'closed-one', resolved: true }] });
  const text = calls[0].messages[0].content;
  assert.match(text, /immediacy/);
  assert.match(text, /Revisit words and threats/);
  assert.match(text, /open-one/);
  assert.ok(!text.includes('closed-one'));
  assert.match(sessionDigest('## Gaps\n- a\n## Next time\nb'), /a/);
});

test('Claude tutor: a whole encounter can start through the engine with the scripted provider', async () => {
  const { tutor } = scripted();
  const enc = createEncounter({ subsection: SUB, tutor });
  const first = await enc.next();
  assert.equal(first.prompt.stage, 1);
  assert.match(first.prompt.text, /Welcome/);
});
