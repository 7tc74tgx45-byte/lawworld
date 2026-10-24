import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSection, listHeadings, sessionFilesFor } from '../src/logic/notes.js';
import { tryParseJson, parseWithRepair, cleanEvaluation, cleanPrompt, stripFences } from '../src/logic/tutorJson.js';
import { OFFLINE_BANK } from '../src/data/offlineBank.js';
import { createOfflineTutor } from '../src/api/offlineTutor.js';
import { createClaudeTutor } from '../src/api/tutor.js';
import { createEncounter } from '../src/logic/encounter.js';
import { curriculum } from '../src/data/curriculum.js';
import { findSubsection } from '../src/logic/curriculum.js';
import { TUTOR_PERSONAS, personaSystemPrompt } from '../src/data/tutors.js';

const MD = ['# Title', 'intro', '## 2.1 First', 'a', '### Sub:', 'b', '## 2.2 Second', 'c', '```', '## not a heading', '```', '---', '## 2.3 Third', 'd'].join('\n');

test('extractSection returns a section including nested headings', () => {
  const s = extractSection(MD, '2.1 First');
  assert.match(s, /^## 2\.1 First/);
  assert.match(s, /### Sub:/);
  assert.ok(!s.includes('2.2 Second'));
});
test('extractSection matches loosely, stops at same level, ignores fenced code', () => {
  assert.match(extractSection(MD, 'sub'), /^### Sub:\nb$/);
  assert.match(extractSection(MD, '## **2.2 second**'), /c/);
  assert.ok(!extractSection(MD, '2.2 Second').includes('---'));
  assert.equal(extractSection(MD, 'Nope'), '');
  assert.equal(extractSection(MD, ''), '');
  assert.equal(listHeadings(MD).some((h) => h.text === 'not a heading'), false);
});
test('sessionFilesFor filters by subsection and sorts newest first', () => {
  const f = ['TUTOR-SESSION-2026-01-01-0900-a.b.md', 'TUTOR-SESSION-2026-02-01-0900-a.b.md', 'TUTOR-SESSION-2026-02-01-0900-x.md', 'LAW.md'];
  assert.deepEqual(sessionFilesFor(f, 'a.b'), [f[1], f[0]]);
});

test('tryParseJson handles fences, prose and trailing commas', () => {
  assert.deepEqual(tryParseJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(tryParseJson('Sure! {"a":"x}y"} hope that helps'), { a: 'x}y' });
  assert.deepEqual(tryParseJson('{"a":[1,2,],}'), { a: [1, 2] });
  assert.equal(tryParseJson('no json'), null);
  assert.equal(stripFences('```\nhi\n```'), 'hi');
});
test('parseWithRepair retries exactly once', async () => {
  let n = 0;
  const ok = await parseWithRepair('garbage', async () => { n++; return '{"text":"hi"}'; });
  assert.equal(ok.text, 'hi');
  assert.equal(n, 1);
  n = 0;
  await assert.rejects(parseWithRepair('bad', async () => { n++; return 'still bad'; }));
  assert.equal(n, 1);
  n = 0;
  await parseWithRepair('{"a":1}', async () => { n++; return ''; });
  assert.equal(n, 0);
});
test('cleanEvaluation rejects unknown verdicts and keeps follow-up only when not solid', () => {
  assert.equal(cleanEvaluation({ verdict: 'great', feedback: 'x' }), null);
  assert.equal(cleanEvaluation({ verdict: 'solid', feedback: '' }), null);
  const e = cleanEvaluation({ verdict: 'Solid', feedback: 'ok', followUp: 'more?', conceptsHit: ['a'], iracScore: 9 });
  assert.equal(e.followUp, undefined);
  assert.equal(e.iracScore, 4);
  assert.equal(cleanPrompt({ text: 'q', options: ['a', 'b'], correct: 0 }, { mcq: true }), null);
});

test('personas: three, each with voice examples; prompt carries shared rules', () => {
  assert.deepEqual(Object.keys(TUTOR_PERSONAS).sort(), ['chen', 'hale', 'okafor']);
  for (const p of Object.values(TUTOR_PERSONAS)) assert.ok(p.voice.length >= 2);
  assert.match(personaSystemPrompt('okafor'), /Never invent a case name/);
  assert.match(personaSystemPrompt('okafor'), /Occupiers' Liability Act 1984 exists/);
});

const BANKED = ['contract-intro.what-is-contract', 'contract-agreement.objective-approach', 'contract-agreement.offer-and-acceptance', 'tort-trespass.assault'];
test('bank exists for the first three contract subsections and first tort subsection, with 7 stages', () => {
  for (const id of BANKED) {
    const sub = findSubsection(curriculum, id);
    assert.ok(sub, id);
    const b = OFFLINE_BANK[id];
    for (const n of [1, 2, 3, 4, 5, 6, 7]) assert.ok(b[n], `${id} stage ${n}`);
    assert.equal(b[6].questions.length, 3);
    for (const n of [2, 3, 4, 5]) {
      assert.equal(b[n].hints.length, 2);
      assert.ok(b[n].modelAnswer.length > 50);
      for (const h of b[n].hints) assert.ok(!b[n].modelAnswer.includes(h));
    }
    for (const q of b[6].questions) assert.ok(q.correct >= 0 && q.correct < q.options.length);
  }
});

test('offline evaluator verdicts: strong answer solid, vague answer not solid, empty-ish missing', () => {
  const b = OFFLINE_BANK['tort-trespass.assault'];
  const strong = 'Assault is an act of the defendant causing the claimant reasonable apprehension of the infliction of a battery, meaning immediate force. No contact is needed. Words can make or negate an assault (Tuberville v Savage). Battery is the intentional and direct application of force.';
  assert.equal(b[3].evaluation(strong).verdict, 'solid');
  const vague = b[3].evaluation('It is when someone is rude to you in a pub and you get cross.');
  assert.equal(vague.verdict, 'missing');
  assert.ok(vague.followUp);
  const partial = b[3].evaluation('Assault means the claimant has a reasonable apprehension of a battery, which has to be immediate force, and it is an act of the defendant.');
  assert.equal(partial.verdict, 'partial');
  assert.ok(partial.conceptsMissed.length > 0);
  // stage 4 needs a named authority
  assert.equal(b[4].evaluation('It was about a fight and some words in a pub somewhere long ago.').verdict, 'missing');
  const auth = b[4].evaluation('Tuberville v Savage: he put his hand on his sword and said if it were not assize-time he would not take such language. Held it was not an assault because his words negated the threat. It matters because words can negate an assault.');
  assert.equal(auth.verdict, 'solid');
});

test('offline stage 5 needs IRAC structure for solid (contract-agreement.offer-and-acceptance)', () => {
  const b = OFFLINE_BANK['contract-agreement.offer-and-acceptance'];
  const body = 'Adams v Lindsell means acceptance by post is complete on posting, and Omar\'s acceptance on Wednesday came before the revocation arrived; Byrne v Van Tienhoven says revocation takes effect only when communicated to an offeree who has accepted a matching offer. Omar has a contract formed on Wednesday.';
  const flat = b[5].evaluation(body);
  const irac = b[5].evaluation(`Issue: whether there is a contract. Rule: ${body} Application: here the withdrawal arrived on Thursday. Conclusion: therefore a contract was formed, it is too late.`);
  assert.equal(irac.verdict, 'solid');
  assert.notEqual(flat.verdict, 'solid');
});

test('offline tutor throws a clear error for an unbanked subsection, and prior gaps appear in the intro', () => {
  const t = createOfflineTutor();
  assert.throws(() => t.generate(1, { subsection: { id: 'nope' } }), /does not cover/);
  const p = t.generate(1, { subsection: { id: 'tort-trespass.assault' }, priorGaps: [{ concept: 'words negate assault' }] });
  assert.match(p.text, /words negate assault/);
  assert.match(t.answerQuestion('what is thomas v NUM', { subsection: { id: 'tort-trespass.assault' } }).text, /will not guess|no detail/);
});

test('a full offline encounter on a new subsection reaches a verdict', async () => {
  const sub = findSubsection(curriculum, 'tort-trespass.assault');
  const enc = createEncounter({ subsection: sub, tutor: createOfflineTutor() });
  await enc.next();
  let r = await enc.next();
  assert.equal(r.prompt.stage, 2);
  assert.equal(OFFLINE_BANK[sub.id][6].questions.length, 3);
});

test('Claude tutor: builds context from the live note, repairs bad JSON once, marks web answers external', async () => {
  const calls = [];
  const replies = [
    '{"text":"Welcome back."}',                       // intro
    'oops not json',                                  // question (bad) ...
    '```json\n{"text":"Explain assault.","modelAnswer":"Apprehension of immediate force."}\n```', // ... repaired
    '{"inNote":false,"text":"The note does not cover that."}',
    'Web answer text.',
  ];
  const sub = { id: 's1', title: 'Assault', module: 'Tort Law', sourceFile: 'N.md', heading: 'ASSAULT', keyConcepts: ['a'], keyCases: [], statutes: [] };
  const tutor = createClaudeTutor({
    personaId: 'okafor',
    call: async (req) => { calls.push(req); return { text: replies.shift() }; },
    readNote: async () => '# T\n## ASSAULT\nAssault is X.\n## BATTERY\nNo.',
    listFiles: async () => [],
  });
  const ctx = { subsection: sub, priorGaps: [{ concept: 'immediacy' }], answers: [] };
  assert.equal((await tutor.generate(1, ctx)).text, 'Welcome back.');
  assert.match(calls[0].messages[0].content, /Assault is X\./);
  assert.ok(!calls[0].messages[0].content.includes('No.'), 'only the requested section');
  assert.match(calls[0].messages[0].content, /immediacy/);
  assert.match(calls[0].system, /Ms Okafor/);
  const q = await tutor.generate(2, ctx);
  assert.equal(q.text, 'Explain assault.');
  assert.equal(calls.length, 3, 'one repair retry');
  const a = await tutor.answerQuestion('What about trespass to land?', ctx);
  assert.equal(a.external, true);
  assert.equal(a.text, 'Web answer text.');
  assert.deepEqual(calls[4].tools[0].name, 'web_search');
  assert.equal(calls[3].tools, undefined, 'note-first call has no web tool');
});

test('Claude tutor: unreadable note surfaces an error so the engine does not count the exchange', async () => {
  const tutor = createClaudeTutor({ call: async () => ({ text: '{}' }), readNote: async () => { throw new Error('down'); }, listFiles: async () => [] });
  await assert.rejects(tutor.generate(1, { subsection: { id: 'x', title: 'X', heading: 'H', sourceFile: 'f.md' } }), /down/);
});
