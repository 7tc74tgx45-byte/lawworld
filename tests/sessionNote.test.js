import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sessionFilename, formatSessionNote, parseSessionNote, formatSessionMemory, hasSessionContent,
  isSessionFileFor, sessionIdPart,
} from '../src/logic/sessionNote.js';
import { sessionFilesFor } from '../src/logic/notes.js';
import { checkWritePath } from '../src/logic/noteGuard.js';
import { writeSessionNote, loadPriorSessions } from '../src/api/sessionNotes.js';
import { createEncounter } from '../src/logic/encounter.js';
import { createOfflineTutor, gapLine } from '../src/api/offlineTutor.js';
import { createClaudeTutor } from '../src/api/tutor.js';
import { curriculum } from '../src/data/curriculum.js';

const SUB = { id: 'contract-agreement.offer-and-acceptance', title: 'Offer and acceptance', module: 'Contract Law' };
const D = new Date(2026, 2, 5, 9, 7); // 5 Mar 2026, 09:07 local

const RESULT = {
  subsectionId: SUB.id,
  tutor: 'Ms Okafor, Solicitor',
  outcome: 'explored',
  finished: true,
  stages: {
    2: { answered: true, verdict: 'solid', followUps: 0, hints: 0, notSure: false, conceptsHit: ['offer'] },
    3: { answered: true, verdict: 'partial', followUps: 2, hints: 1, notSure: false, conceptsHit: ['acceptance'] },
    4: { answered: true, verdict: 'solid', followUps: 0, hints: 0, notSure: false, conceptsHit: ['Carlill'] },
    5: { answered: true, verdict: 'partial', followUps: 1, hints: 0, notSure: true, iracScore: 3, conceptsHit: [] },
  },
  checkpoint: { correct: 1, total: 3, answered: 3, conceptsHit: ['revocation'] },
  gaps: [
    { subsectionId: SUB.id, concept: 'postal rule exceptions', stage: 3, verdict: 'partial' },
    { subsectionId: SUB.id, concept: 'postal rule exceptions', stage: 3, verdict: 'partial' },
    { subsectionId: SUB.id, concept: 'revocation', stage: 6, verdict: 'missing' },
  ],
  reflections: [],
};

test('sessionFilename: TUTOR-SESSION-YYYY-MM-DD-HHMM-<id>.md, zero padded, local time', () => {
  assert.equal(sessionFilename(D, SUB.id), 'TUTOR-SESSION-2026-03-05-0907-contract-agreement.offer-and-acceptance.md');
  assert.equal(sessionFilename(new Date(2026, 11, 31, 23, 59), 'x'), 'TUTOR-SESSION-2026-12-31-2359-x.md');
  assert.throws(() => sessionFilename('not a date', 'x'));
});
test('sessionFilename is always accepted by the write guard, even for odd ids; never produces a path', () => {
  for (const id of ['a/b', '../evil', 'with space', '', 'LAW7054-Tort-Ch8-Breach-Standard-of-Care']) {
    const f = sessionFilename(D, id);
    assert.equal(checkWritePath(f).ok, true, f);
    assert.ok(!f.slice(1).includes('/'));
  }
  assert.equal(sessionIdPart('a/b c'), 'a-b-c');
  assert.equal(sessionIdPart(''), 'unknown');
});
test('isSessionFileFor / sessionFilesFor match the exact subsection only, newest first', () => {
  const files = [
    'TUTOR-SESSION-2026-01-01-0900-a.b.md',
    'TUTOR-SESSION-2026-02-01-0900-a.b.md',
    'TUTOR-SESSION-2026-02-01-0900-x.a.b.md', // a different subsection whose id ends the same way
    'TUTOR-SESSION-2026-02-01-0900-b.md',
    'LAW7054-Contract-W1.md',
  ];
  assert.deepEqual(sessionFilesFor(files, 'a.b'), [files[1], files[0]]);
  assert.equal(isSessionFileFor(files[2], 'a.b'), false);
  assert.equal(isSessionFileFor(sessionFilename(D, SUB.id), SUB.id), true);
});

test('formatSessionNote: frontmatter fields and the four sections', () => {
  const md = formatSessionNote({ date: D, subsection: SUB, module: 'Contract Law', district: 'Agreement', tutor: RESULT.tutor, result: RESULT });
  assert.match(md, /^---\ndate: 2026-03-05\n/);
  for (const f of ['module: "Contract Law"', 'district: "Agreement"', `subsection: "${SUB.id}"`, 'tutor: "Ms Okafor, Solicitor"', 'outcome: explored']) {
    assert.ok(md.includes(f), f);
  }
  const heads = md.split('\n').filter((l) => l.startsWith('## '));
  assert.deepEqual(heads, ['## Covered', '## Landed', '## Gaps', '## Next time']);
  assert.match(md, /- Precision: partial \(2 follow-ups, 1 hint\)/);
  assert.match(md, /- Application: partial \(.*IRAC 3\/4\)/);
  assert.match(md, /- Checkpoint: 1\/3/);
});
test('formatSessionNote: gaps are de-duplicated, landed excludes gaps, next time names what to revisit', () => {
  const md = formatSessionNote({ date: D, subsection: SUB, result: RESULT });
  assert.equal(md.match(/postal rule exceptions/g).length >= 2, true); // once in Gaps, once in Next time
  assert.equal(md.split('\n').filter((l) => l.startsWith('- postal rule exceptions')).length, 1);
  const landed = md.split('## Landed')[1].split('## Gaps')[0];
  assert.match(landed, /offer/);
  assert.match(landed, /Carlill/);
  assert.ok(!landed.includes('revocation')); // revocation is a gap, so it has not "landed"
  assert.match(md.split('## Next time')[1], /Open with a retrieval question on: postal rule exceptions; revocation/);
  assert.match(md.split('## Next time')[1], /Application must come out solid|Precision and Application must come out solid/);
});
test('formatSessionNote: an early leave says so and lists unanswered stages; no gaps reads "None logged"', () => {
  const left = { ...RESULT, finished: false, outcome: 'explored', gaps: [], stages: { ...RESULT.stages, 4: { answered: false }, 5: { answered: false } }, checkpoint: { correct: 0, total: 3, answered: 0, conceptsHit: [] } };
  const md = formatSessionNote({ date: D, subsection: SUB, result: left });
  assert.match(md, /finished: false/);
  assert.match(md, /Left before the verdict/);
  assert.match(md, /Authority: not answered/);
  assert.match(md, /Still to answer: Authority, Application/);
  assert.match(md, /## Gaps\n- None logged\./);
});
test('formatSessionNote never copies the transcript, and quotes cannot break the frontmatter', () => {
  const md = formatSessionNote({ date: D, subsection: { id: 'x', title: 'Say "hi"' }, tutor: 'T "quoted"', result: { ...RESULT, transcript: [{ text: 'SECRET TRANSCRIPT TEXT' }] } });
  assert.ok(!md.includes('SECRET TRANSCRIPT TEXT'));
  assert.match(md, /title: "Say \\"hi\\""/);
});
test('consolidated outcome is written as consolidated', () => {
  const md = formatSessionNote({ date: D, subsection: SUB, result: { ...RESULT, outcome: 'consolidated', gaps: [] } });
  assert.match(md, /outcome: consolidated/);
});

test('round trip: parseSessionNote reads back gaps and next-time; formatSessionMemory is compact', () => {
  const md = formatSessionNote({ date: D, subsection: SUB, result: RESULT });
  const s = parseSessionNote(md, sessionFilename(D, SUB.id));
  assert.equal(s.date, '2026-03-05');
  assert.equal(s.outcome, 'explored');
  assert.deepEqual(s.gaps, ['postal rule exceptions', 'revocation']);
  assert.ok(s.nextTime.length >= 2);
  const line = formatSessionMemory(s);
  assert.match(line, /Gaps: postal rule exceptions; revocation\./);
  assert.match(line, /Next time:/);
  assert.ok(line.length <= 700);
  assert.deepEqual(parseSessionNote('no frontmatter', 'TUTOR-SESSION-2026-01-02-1000-x.md').gaps, []);
  assert.equal(parseSessionNote('', 'TUTOR-SESSION-2026-01-02-1000-x.md').date, '2026-01-02');
});

test('hasSessionContent: nothing answered means no note', () => {
  assert.equal(hasSessionContent(null), false);
  assert.equal(hasSessionContent({ stages: { 2: { answered: false } }, checkpoint: { answered: 0 } }), false);
  assert.equal(hasSessionContent(RESULT), true);
  assert.equal(hasSessionContent({ stages: { 2: { answered: false, notSure: true } }, checkpoint: { answered: 0 } }), true);
});

test('writeSessionNote writes one guarded TUTOR-SESSION file with module and district from the curriculum', async () => {
  const sub = curriculum.modules[1].regions[0].districts[0].subsections[0];
  const writes = [];
  const r = await writeSessionNote({ subsection: sub, result: RESULT, date: D, writeNote: async (f, t) => { writes.push([f, t]); } });
  assert.equal(r.ok, true);
  assert.equal(writes.length, 1);
  assert.ok(writes[0][0].startsWith('TUTOR-SESSION-2026-03-05-0907-'));
  assert.match(writes[0][1], /module: "Contract Law"/);
  assert.match(writes[0][1], /district: "(?!")/);
});
test('writeSessionNote: nothing answered writes nothing; a failing vault is reported, not thrown', async () => {
  let n = 0;
  const empty = await writeSessionNote({ subsection: SUB, result: { stages: {}, checkpoint: { answered: 0 } }, writeNote: async () => { n++; } });
  assert.equal(empty.skipped, true);
  assert.equal(n, 0);
  const bad = await writeSessionNote({ subsection: SUB, result: RESULT, writeNote: async () => { throw new Error('Obsidian closed'); } });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /Obsidian closed/);
});

test('loadPriorSessions: newest two matching notes; failures mean no memory', async () => {
  const old = formatSessionNote({ date: new Date(2026, 0, 1, 9, 0), subsection: SUB, result: RESULT });
  const files = [sessionFilename(new Date(2026, 0, 1, 9, 0), SUB.id), sessionFilename(new Date(2026, 1, 1, 9, 0), SUB.id), sessionFilename(new Date(2026, 2, 1, 9, 0), SUB.id), sessionFilename(D, 'other')];
  const read = [];
  const got = await loadPriorSessions(SUB, { listFiles: async () => files, readNote: async (f) => { read.push(f); return old; } });
  assert.equal(got.length, 2);
  assert.deepEqual(read, [files[2], files[1]]);
  assert.deepEqual(await loadPriorSessions(SUB, { listFiles: async () => { throw new Error('x'); } }), []);
});

test('offline intro references earlier-session gaps ("Last time ... didn\'t fully land")', async () => {
  const memory = [{ date: '2026-03-01', outcome: 'explored', gaps: ['postal rule exceptions'], nextTime: [] }];
  assert.match(gapLine([], memory), /Last time postal rule exceptions didn't fully land/);
  assert.equal(gapLine([], []), '');
  const enc = createEncounter({ subsection: { ...SUB, keyConcepts: [], keyCases: [], statutes: [] }, tutor: createOfflineTutor({ personaId: 'hale' }), loadMemory: async () => memory });
  const first = await enc.next();
  assert.match(first.messages[0].text, /Last time postal rule exceptions didn't fully land/);
});
test('a failing memory loader does not stop the encounter', async () => {
  const enc = createEncounter({ subsection: { ...SUB, keyConcepts: [], keyCases: [], statutes: [] }, tutor: createOfflineTutor(), loadMemory: async () => { throw new Error('vault down'); } });
  const first = await enc.next();
  assert.equal(first.ok, true);
  assert.doesNotMatch(first.messages[0].text, /Last time/);
});

test('Claude intro prompt includes the earlier session Gaps and Next time and demands a reference to them', async () => {
  const calls = [];
  const md = formatSessionNote({ date: D, subsection: SUB, result: RESULT });
  const tutor = createClaudeTutor({
    personaId: 'chen',
    call: async (req) => { calls.push(req.messages[0].content); return { text: '{"text":"Last time the postal rule exceptions did not land."}' }; },
    readNote: async (f) => (f.startsWith('TUTOR-SESSION-') ? md : '# N\n## Offer and acceptance\nBody.'),
    listFiles: async () => [sessionFilename(D, SUB.id)],
  });
  const sub = { ...SUB, sourceFile: 'N.md', heading: 'Offer and acceptance', keyConcepts: [], keyCases: [], statutes: [] };
  const enc = createEncounter({ subsection: sub, tutor });
  const first = await enc.next();
  assert.match(first.messages[0].text, /Last time the postal rule exceptions/);
  assert.match(calls[0], /postal rule exceptions/);
  assert.match(calls[0], /you MUST refer to at least one of them/);
  // With no memory at all the prompt tells the model not to invent any.
  const calls2 = [];
  const t2 = createClaudeTutor({ call: async (r) => { calls2.push(r.messages[0].content); return { text: '{"text":"Welcome."}' }; }, readNote: async () => '# N\n## Offer and acceptance\nBody.', listFiles: async () => [] });
  await createEncounter({ subsection: sub, tutor: t2 }).next();
  assert.match(calls2[0], /do not pretend there was one/);
});

test('the guard still refuses the protected note even if a session helper is misused', async () => {
  const r = await writeSessionNote({ subsection: { id: 'x', title: 'x' }, result: RESULT, writeNote: async (f) => { assert.ok(f.startsWith('TUTOR-SESSION-')); } });
  assert.equal(r.ok, true);
  assert.equal(checkWritePath('LAW7054-Tort-Ch8-Breach-Standard-of-Care.md').ok, false);
});
